import type { SiteConfig } from "@/lib/config/types";
import { deriveFailureView } from "@/lib/tracking/derive/failure-view";
import { dataGuideKey } from "@/lib/tracking/derive/keys";
import { deriveSuccessView } from "@/lib/tracking/derive/success-view";
import type { GuideKey, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

export { isOverdue, worryDateKey } from "@/lib/tracking/derive/worry";

/**
 * The one source of truth for result and error screens, CS replies, previews and tests (spec §2 원칙 3).
 * `now` is the client's clock when the result settles (never read during render); every date is judged in KST.
 */
export function deriveTrackingView(outcome: LookupOutcome, now: Date, config: SiteConfig): TrackingViewModel {
  return outcome.kind === "success"
    ? deriveSuccessView(outcome.request, outcome.data, now, config)
    : deriveFailureView(outcome, now, config);
}

export function guideKeyForData(data: TrackResponseData, now: Date, config: SiteConfig): GuideKey {
  return dataGuideKey(data, now, config);
}
