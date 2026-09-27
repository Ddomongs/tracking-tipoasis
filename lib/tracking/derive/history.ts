import type { SiteConfig } from "@/lib/config/types";
import type { TimedEvent } from "@/lib/tracking/derive/events";
import { STATIONS, stationForCode } from "@/lib/tracking/derive/spine";
import { glossaryLabel } from "@/lib/tracking/glossary";
import { fillSlots } from "@/lib/tracking/template";
import { formatKstDateTime, formatKstShortDateTime } from "@/lib/tracking/time";
import type { HistoryEventView, HistorySegmentView, HistoryView, LastEventView, StationId } from "@/lib/tracking/types";

const RECENT_COUNT = 3;

function stationTitle(station: StationId, config: SiteConfig): string {
  const copy = config.resultCopy;
  switch (station) {
    case "departed":
      return copy.stationDeparted;
    case "customs":
      return copy.stationCustoms;
    case "domestic":
      return copy.stationDomestic;
    case "arrived":
      return copy.stationArrived;
  }
}

function eventView(item: TimedEvent, config: SiteConfig): HistoryEventView {
  const { label, original } = glossaryLabel(item.event.status, config.glossary);
  const place = item.event.location?.trim() ?? "";
  return {
    at: item.at.toISOString(),
    timeText: formatKstDateTime(item.at),
    label,
    original,
    place: place.length > 0 ? place : null
  };
}

/** '9월 23일 (수) 14:10 · 통관 접수' with the original term kept for the small print. */
export function lastEventFor(item: TimedEvent | null, config: SiteConfig): LastEventView | null {
  if (item === null) return null;
  const view = eventView(item, config);
  return { at: view.at, label: view.label, original: view.original, place: view.place, text: `${view.timeText} · ${view.label}` };
}

export function historyFor(events: readonly TimedEvent[], config: SiteConfig): HistoryView {
  const copy = config.resultCopy;
  const views = events.map((item) => eventView(item, config));
  const count = views.length;
  const latest = count > 0 ? events[count - 1] : null;
  const summary = fillSlots(copy.historySummary, { n: String(count) });
  const segments: HistorySegmentView[] = STATIONS.flatMap((station) => {
    const inStation = events.filter((item) => stationForCode(item.event.statusCode) === station).map((item) => eventView(item, config));
    return inStation.length === 0 ? [] : [{ station, title: stationTitle(station, config), events: inStation }];
  });
  return {
    count,
    summaryText: latest === null ? summary : `${summary} · ${fillSlots(copy.historyLast, { time: formatKstShortDateTime(latest.at) })}`,
    emptyText: count === 0 ? copy.historyEmpty : null,
    segments,
    recent: views.slice(-RECENT_COUNT).reverse()
  };
}
