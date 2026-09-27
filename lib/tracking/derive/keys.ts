import type { SiteConfig } from "@/lib/config/types";
import { hasAnyEvent, latestEvent, timedEvents } from "@/lib/tracking/derive/events";
import type { CtaState, GuideKey } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

export type DataGuideKey = Extract<
  GuideKey,
  "pending" | "customsArrived" | "customsWaiting" | "customsCleared" | "handedToCarrier" | "pickedUp"
  | "inTransit" | "delivered" | "stale" | "lookupUnavailable" | "ambiguous"
>;
export type CodeGuideKey = Extract<
  DataGuideKey, "customsArrived" | "customsWaiting" | "customsCleared" | "handedToCarrier" | "pickedUp" | "inTransit" | "delivered"
>;

const PICKUP_PATTERN = /(집화|집하|상품\s*인수)/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The state the status code alone implies (ignores pending/stale/carrier problems). */
export function codeGuideKey(data: TrackResponseData): CodeGuideKey {
  switch (data.currentStatusCode) {
    case 7:
      return "delivered";
    case 6:
      return "inTransit";
    case 5:
      return PICKUP_PATTERN.test(data.currentStatus) ? "pickedUp" : "handedToCarrier";
    case 4:
      return "customsCleared";
    case 3:
    case 2:
      return "customsWaiting";
    case 1:
      return "customsArrived";
  }
}

/** Same rule as the server (lib/services/normalizer.ts): no new event for more than staleDays, except delivered. */
function isStaleAt(data: TrackResponseData, now: Date, staleDays: number): boolean {
  if (data.currentStatusCode === 7) return false;
  const latest = latestEvent(timedEvents(data));
  return latest !== null && now.getTime() - latest.at.getTime() > staleDays * DAY_MS;
}

/** Priority: ambiguous(0 events) > lookupUnavailable(0 events) > pending > delivered > stale > code-based. */
export function dataGuideKey(data: TrackResponseData, now: Date, config: SiteConfig): DataGuideKey {
  const hasEvents = hasAnyEvent(data);
  if (data.delivery.ambiguous === true && !hasEvents) return "ambiguous";
  if (data.delivery.lookupUnavailable === true && !hasEvents) return "lookupUnavailable";
  if (data.isPending === true) return "pending";
  if (data.currentStatusCode === 7) return "delivered";
  if (data.estimateStale === true || isStaleAt(data, now, config.durations.staleDays)) return "stale";
  return codeGuideKey(data);
}

export function ctaStateFor(key: DataGuideKey): CtaState {
  switch (key) {
    case "pending":
      return "pending";
    case "customsArrived":
    case "customsWaiting":
      return "customsWaiting";
    case "customsCleared":
    case "handedToCarrier":
    case "pickedUp":
      return "customsCleared";
    case "inTransit":
    case "delivered":
    case "stale":
    case "lookupUnavailable":
    case "ambiguous":
      return key;
  }
}
