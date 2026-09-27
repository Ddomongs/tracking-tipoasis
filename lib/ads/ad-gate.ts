import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { isNumberPath } from "@/lib/privacy/url-scrub";
import type { ScrubStatus } from "@/lib/privacy/url-scrub";

/**
 * When the AdSense loader may be inserted (spec §3, §8, §16 items 6–7). Pure and fail-closed.
 * - "neverOnNumberRoutes": approval 6 fallback — a document that started on a number route never gets the loader.
 * - "afterScrub": approval 6 — a number-route document gets it once the URL scrub is confirmed.
 * - "afterAllowedResult": approval 7 — implemented by S08; closed until then.
 */
export type AdTimingPolicy = "afterScrub" | "afterAllowedResult" | "neverOnNumberRoutes";

/** Approval 6 is recorded in roadmap §4: number-route documents load ads once the URL scrub is confirmed.
 *  S08 switches this to "afterAllowedResult" when approval 7 is recorded. */
export const AD_TIMING_POLICY: AdTimingPolicy = "afterScrub";

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
      return false;
  }
}
