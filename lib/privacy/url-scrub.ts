import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";

/**
 * Candidate B URL scrub (spec §3, GAP1-02). Browser only; never rejects.
 * ① wait (rAF retries) until the App Router committed its first history entry (history.state.__NA)
 *   and installed its history.replaceState patch (an own property of window.history),
 * ② beforeReplace() — the caller stashes { number, carrier, savedAt } for restore,
 * ③ history.replaceState(null, "", "/") — drops path, query and hash,
 * ④ confirm that location is exactly "/".
 * Scrubbing from an inline <head> script before hydration is forbidden (GAP1-01).
 */
export const SCRUB_TIMEOUT_MS = 15000;

export type ScrubStatus = "scrubbed" | "notNeeded" | "failed";

interface ScrubOptions {
  readonly timeoutMs: number;
  readonly beforeReplace: () => void;
}

const RESERVED_SEGMENTS: ReadonlySet<string> = new Set(["privacy", "internal", "api", "guide"]);
const SINGLE_SEGMENT = /^\/([^/]+)$/;

/** One path segment that is not privacy|internal|api|guide and has no dot. */
export function isNumberPath(pathname: string): boolean {
  const match = SINGLE_SEGMENT.exec(pathname);
  if (!match) return false;
  const segment = match[1];
  return !segment.includes(".") && !RESERVED_SEGMENTS.has(segment);
}

function urlCarriesNumber(): boolean {
  const { pathname, search, hash } = window.location;
  if (isNumberPath(pathname)) return true;
  try {
    return containsTrackingLikeValue(`${pathname}${search}${hash}`);
  } catch {
    return true;
  }
}

function isHistoryPatched(): boolean {
  return Object.prototype.hasOwnProperty.call(window.history, "replaceState");
}

function isRouterReady(): boolean {
  const state: unknown = window.history.state;
  const committed = typeof state === "object" && state !== null && "__NA" in state && state.__NA === true;
  return committed && isHistoryPatched();
}

function isRoot(): boolean {
  const { pathname, search, hash } = window.location;
  return pathname === "/" && search === "" && hash === "";
}

function waitForRouter(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const tick = (): void => {
      if (isRouterReady()) {
        resolve(true);
        return;
      }
      if (performance.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
}

const guardedWindows = new WeakSet<object>();

/**
 * History entries created before hydration (for example a #hash link tapped while scripts were still
 * loading) keep the number. Back/forward to such an entry is replaced with "/" inside the same task,
 * before any other script can read location.
 */
function installHistoryGuard(): void {
  if (guardedWindows.has(window)) return;
  guardedWindows.add(window);
  window.addEventListener("popstate", () => {
    try {
      if (urlCarriesNumber() && isHistoryPatched()) window.history.replaceState(null, "", "/");
    } catch {
      // The ad gate still sees the number path and keeps the loader out.
    }
  });
}

async function runScrub({ timeoutMs, beforeReplace }: ScrubOptions): Promise<ScrubStatus> {
  try {
    if (typeof window === "undefined") return "failed";
    if (!urlCarriesNumber()) return "notNeeded";
    if (!(await waitForRouter(timeoutMs))) return "failed";
    installHistoryGuard();
    if (!urlCarriesNumber()) return "notNeeded";
    try {
      beforeReplace();
    } catch {
      // The restore stash is a convenience; the scrub goes ahead.
    }
    window.history.replaceState(null, "", "/");
    return isRoot() ? "scrubbed" : "failed";
  } catch {
    return "failed";
  }
}

let inFlight: Promise<ScrubStatus> | null = null;

export function scrubNumberFromUrl(options: ScrubOptions): Promise<ScrubStatus> {
  if (inFlight) return inFlight;
  const run = runScrub(options).then((status) => {
    inFlight = null;
    return status;
  });
  inFlight = run;
  return run;
}
