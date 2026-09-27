import { parseInstant } from "@/lib/tracking/time";
import type { TrackResponseData, TrackingEvent } from "@/lib/types";

// Private helper of lib/tracking/derive-view.ts (roadmap §10.2): not imported by other stages.

export interface TimedEvent {
  readonly event: TrackingEvent;
  readonly at: Date;
  readonly source: "customs" | "delivery";
}

function withTimes(events: readonly TrackingEvent[], source: TimedEvent["source"]): TimedEvent[] {
  return events.flatMap((event) => {
    const at = parseInstant(event.datetime);
    return at === null ? [] : [{ event, at, source }];
  });
}

/** Customs and delivery events with a parsable time, oldest first. Events with broken times are skipped. */
export function timedEvents(data: TrackResponseData): readonly TimedEvent[] {
  return [...withTimes(data.customs.events, "customs"), ...withTimes(data.delivery.events, "delivery")]
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function latestEvent(
  events: readonly TimedEvent[], predicate: (item: TimedEvent) => boolean = () => true
): TimedEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const item = events[index];
    if (predicate(item)) return item;
  }
  return null;
}

/** Raw event count as the normalizer sees it (broken times included). */
export function hasAnyEvent(data: TrackResponseData): boolean {
  return data.customs.events.length + data.delivery.events.length > 0;
}
