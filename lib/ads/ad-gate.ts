import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { isNumberPath } from "@/lib/privacy/url-scrub";
import type { ScrubStatus } from "@/lib/privacy/url-scrub";
import type { ViewMode } from "@/lib/tracking/types";

/**
 * When the AdSense loader may be inserted (spec §3, §8, §16 items 6–7). Pure and fail-closed.
 * - "neverOnNumberRoutes": approval 6 fallback — a document that started on a number route never gets the loader.
 * - "afterScrub": approval 6 — a number-route document gets it once the URL scrub is confirmed.
 * - "afterAllowedResult": approval 7 — home documents after an allowed result or a scroll to the showcase; deep-link
 *   documents after a confirmed scrub and an allowed result; never while a problem result is on screen.
 */
export type AdTimingPolicy = "afterScrub" | "afterAllowedResult" | "neverOnNumberRoutes";

/** Approvals 6 and 7 are recorded in roadmap §4 (S08 Task 9). Revert switch for spec §17 Q5: "afterScrub". */
export const AD_TIMING_POLICY: AdTimingPolicy = "afterAllowedResult";

export interface AdGateInput {
  readonly pathname: string;
  readonly entry: "home" | "deepLink";
  readonly scrub: ScrubStatus | "pending";
  readonly resultAdsAllowed: boolean | null;
  readonly scrolledPastLookup: boolean;
  readonly policy: AdTimingPolicy;
}

function isInternalPath(pathname: string): boolean {
  return pathname === "/internal" || pathname.startsWith("/internal/");
}

function pathAllowsAds(pathname: string): boolean {
  if (isNumberPath(pathname) || isInternalPath(pathname)) return false;
  try {
    return !containsTrackingLikeValue(pathname);
  } catch {
    return false;
  }
}

export function shouldInsertAdLoader(input: AdGateInput): boolean {
  if (!pathAllowsAds(input.pathname) || input.scrub === "failed") return false;
  switch (input.policy) {
    case "neverOnNumberRoutes":
      return input.entry === "home";
    case "afterScrub":
      return input.entry === "home" || input.scrub === "scrubbed";
    case "afterAllowedResult":
      // A problem result holds the loader; a later allowed result in the same tab opens the gate once (spec §8).
      if (input.resultAdsAllowed === false) return false;
      if (input.entry === "deepLink") return input.scrub === "scrubbed" && input.resultAdsAllowed === true;
      return input.resultAdsAllowed === true || input.scrolledPastLookup;
  }
}

/**
 * The ad gate of one document (spec §8): "open" — the loader may go in and the manual slot may fill now; "waiting" — not
 * yet, but a confirmed scrub, an allowed result or a scroll to the showcase can still open it in this document;
 * "closed" — never in this document (number or internal path, failed scrub, or a policy that excludes it).
 */
export type AdGateState = "open" | "waiting" | "closed";

export function adGateState(input: AdGateInput): AdGateState {
  if (shouldInsertAdLoader(input)) return "open";
  const best: AdGateInput = {
    ...input,
    scrub: input.scrub === "pending" ? "scrubbed" : input.scrub,
    resultAdsAllowed: true,
    scrolledPastLookup: true
  };
  return shouldInsertAdLoader(best) ? "waiting" : "closed";
}

export type ManualSlotMode = "none" | "reserved" | "filled";

/**
 * The one manual slot before the footer (spec §8): on the home (idle) and on a result whose view allows ads; reserved
 * while the gate may still open, filled while it is open, absent while loading and in every problem state
 * ("문제 상태 광고 0" = manual slot 0 + no new loader).
 */
export function manualSlotMode(input: {
  readonly viewMode: ViewMode;
  readonly resultAdsAllowed: boolean | null;
  readonly gate: AdGateState;
}): ManualSlotMode {
  const allowedHere = input.viewMode === "idle" || (input.viewMode === "settled" && input.resultAdsAllowed === true);
  if (!allowedHere || input.gate === "closed") return "none";
  return input.gate === "open" ? "filled" : "reserved";
}
