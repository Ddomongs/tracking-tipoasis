import type { SiteConfig } from "@/lib/config/types";
import { dataGuideKey } from "@/lib/tracking/derive/keys";
import type { GuideKey } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

export { isOverdue, worryDateKey } from "@/lib/tracking/derive/worry";

export function guideKeyForData(data: TrackResponseData, now: Date, config: SiteConfig): GuideKey {
  return dataGuideKey(data, now, config);
}
