import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { isNumberPath } from "@/lib/privacy/url-scrub";
import type { ScrubStatus } from "@/lib/privacy/url-scrub";

/** Per-document inputs of the ad gate (spec §8). Browser store; read by AdLoader, written by the page. */
export interface AdSignals {
  readonly entry: "home" | "deepLink";
  readonly scrub: ScrubStatus | "pending";
  readonly resultAdsAllowed: boolean | null;
  readonly scrolledPastLookup: boolean;
}

function detectEntry(): AdSignals["entry"] {
  if (typeof window === "undefined") return "deepLink";
  try {
    const { pathname, search, hash } = window.location;
    const carriesNumber = isNumberPath(pathname) || containsTrackingLikeValue(`${pathname}${search}${hash}`);
    return carriesNumber ? "deepLink" : "home";
  } catch {
    return "deepLink";
  }
}

// Decided once per document, when this module is first evaluated in the browser: that happens while
// hydrating, before any effect (and so before the URL scrub) runs.
let signals: AdSignals = {
  entry: detectEntry(),
  scrub: "pending",
  resultAdsAllowed: null,
  scrolledPastLookup: false
};
const listeners = new Set<() => void>();

export function getAdSignals(): AdSignals {
  return signals;
}

export function setAdSignals(patch: Partial<AdSignals>): void {
  const next: AdSignals = {
    entry: patch.entry ?? signals.entry,
    // A failed scrub stops ads for the rest of the document (spec §15: fail-closed).
    scrub: signals.scrub === "failed" ? "failed" : (patch.scrub ?? signals.scrub),
    resultAdsAllowed: patch.resultAdsAllowed === undefined ? signals.resultAdsAllowed : patch.resultAdsAllowed,
    scrolledPastLookup: patch.scrolledPastLookup ?? signals.scrolledPastLookup
  };
  const unchanged =
    next.entry === signals.entry &&
    next.scrub === signals.scrub &&
    next.resultAdsAllowed === signals.resultAdsAllowed &&
    next.scrolledPastLookup === signals.scrolledPastLookup;
  if (unchanged) return;
  signals = next;
  listeners.forEach((listener) => listener());
}

export function subscribeAdSignals(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
