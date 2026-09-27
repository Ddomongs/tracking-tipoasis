import type { SiteConfig } from "@/lib/config/types";
import { latestEvent, timedEvents } from "@/lib/tracking/derive/events";
import type { TimedEvent } from "@/lib/tracking/derive/events";
import { addCalendarDays, businessDaysAfter, kstDateKey, parseInstant } from "@/lib/tracking/time";
import type { KstDateKey } from "@/lib/tracking/time";
import type { GuideKey } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

export function isoToKey(iso: string | undefined): KstDateKey | null {
  if (iso === undefined) return null;
  const instant = parseInstant(iso);
  return instant === null ? null : kstDateKey(instant);
}

function eventKey(item: TimedEvent | null): KstDateKey | null {
  return item === null ? null : kstDateKey(item.at);
}

function earlier(a: KstDateKey | null, b: KstDateKey | null): KstDateKey | null {
  if (a === null) return b;
  if (b === null) return a;
  return a < b ? a : b;
}

function later(a: KstDateKey | null, b: KstDateKey | null): KstDateKey | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}

function plusDays(base: KstDateKey | null, days: number): KstDateKey | null {
  return base === null ? null : addCalendarDays(base, days);
}

/**
 * The date after which an unchanged state becomes overdue (contract §11.6 "Worry dates", clarified by S03 addition 8):
 * estimates the server moved to "today" are capped by the last event + the stage maximum, so the date does not move daily.
 */
export function worryDateKey(data: TrackResponseData, key: GuideKey, config: SiteConfig): KstDateKey | null {
  const events = timedEvents(data);
  const { stages, worry } = config.durations;
  const lastCustoms = eventKey(latestEvent(events, (item) => item.source === "customs"));
  const lastDelivery = eventKey(latestEvent(events, (item) => item.source === "delivery"));
  switch (key) {
    case "customsArrived":
    case "customsWaiting": {
      const base = earlier(isoToKey(data.estimatedCustomsClearanceDate), plusDays(lastCustoms, stages.customs.max));
      return base === null ? null : businessDaysAfter(base, worry.afterEstimateBusinessDays, config.calendar, "customs");
    }
    case "customsCleared":
    case "handedToCarrier":
    case "pickedUp": {
      const cleared = eventKey(latestEvent(events, (item) => item.event.statusCode === 4));
      const base = later(cleared, lastDelivery) ?? isoToKey(data.estimatedCustomsClearanceDate) ?? lastCustoms;
      return base === null ? null : businessDaysAfter(base, worry.afterClearanceBusinessDays, config.calendar, "customs");
    }
    case "inTransit": {
      const base = earlier(isoToKey(data.estimatedDeliveryDate), plusDays(lastDelivery, stages.domestic.max));
      return base === null ? null : businessDaysAfter(base, worry.afterEstimateBusinessDays, config.calendar, "delivery");
    }
    default:
      return null;
  }
}

/** Today (KST, from `now`) is after the worry date. */
export function isOverdue(worry: KstDateKey | null, now: Date): boolean {
  return worry !== null && kstDateKey(now) > worry;
}
