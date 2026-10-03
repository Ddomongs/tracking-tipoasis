import type { SiteConfig } from "@/lib/config/types";
import { latestEvent } from "@/lib/tracking/derive/events";
import type { TimedEvent } from "@/lib/tracking/derive/events";
import type { DataGuideKey } from "@/lib/tracking/derive/keys";
import { isoToKey } from "@/lib/tracking/derive/worry";
import { fillSlots } from "@/lib/tracking/template";
import { addCalendarDays, calendarDaysBetween, formatKstDate, holidayPeriodBetween, isBusinessDay, kstDateKey, weekdayLabel } from "@/lib/tracking/time";
import type { KstDateKey } from "@/lib/tracking/time";
import type { CustomsEstimateView, EtaDate, EtaView } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

const CUSTOMS_ESTIMATE_KEYS: ReadonlySet<DataGuideKey> = new Set<DataGuideKey>(["customsArrived", "customsWaiting"]);
const CUSTOMS_DONE_KEYS: ReadonlySet<DataGuideKey> = new Set<DataGuideKey>(["customsCleared", "handedToCarrier", "pickedUp"]);

export interface EtaInput {
  readonly data: TrackResponseData;
  readonly key: DataGuideKey;
  readonly overdue: boolean;
  readonly now: Date;
  readonly events: readonly TimedEvent[];
  readonly config: SiteConfig;
}

export function etaDate(key: KstDateKey): EtaDate {
  const [, month, day] = key.split("-").map(Number);
  return { key, label: formatKstDate(key), month, day, weekday: weekdayLabel(key) };
}

/** Secondary line: '통관 완료 예상 9월 26일 (토)' (normalizer value as it is) or '통관 완료 9월 23일 (수)'. */
function captionFor(input: EtaInput): string | null {
  const { data, key, events, config } = input;
  if (CUSTOMS_ESTIMATE_KEYS.has(key)) {
    const estimate = isoToKey(data.estimatedCustomsClearanceDate);
    return estimate === null ? null : fillSlots(config.resultCopy.customsEstimateCaption, { date: formatKstDate(estimate) });
  }
  if (CUSTOMS_DONE_KEYS.has(key)) {
    const cleared = latestEvent(events, (item) => item.event.statusCode === 4);
    if (cleared !== null) return fillSlots(config.resultCopy.customsDoneCaption, { date: formatKstDate(cleared.at) });
    // No code-4 event (a domestic lookup without customs data): the normalizer's clearance date, the same fallback
    // the worry-date base uses (contract addition 8).
    const clearedOn = isoToKey(data.estimatedCustomsClearanceDate);
    return clearedOn === null ? null : fillSlots(config.resultCopy.customsDoneCaption, { date: formatKstDate(clearedOn) });
  }
  return null;
}

function estimateEta(input: EtaInput): EtaView {
  const { data, overdue, now, events, config } = input;
  const copy = config.resultCopy;
  const estimateKey = isoToKey(data.estimatedDeliveryDate);
  if (estimateKey === null) return { kind: "unknown", label: copy.etaLabel, text: copy.etaUnknownText };
  if (overdue) return { kind: "overdue", label: copy.etaOverdueLabel, date: etaDate(estimateKey) };
  const today = kstDateKey(now);
  const shownKey = estimateKey < today ? today : estimateKey;
  const date = etaDate(shownKey);
  const caption = captionFor(input);
  const last = latestEvent(events);
  const holiday = holidayPeriodBetween(last === null ? today : kstDateKey(last.at), shownKey, config.calendar);
  if (holiday !== null) {
    return { kind: "holidayAffected", label: copy.etaLabel, date, badge: holiday.badge, holidayName: holiday.name, caption };
  }
  const dday = calendarDaysBetween(today, shownKey);
  if (dday === 0) return { kind: "today", label: copy.etaTodayLabel, date, caption };
  return { kind: "date", label: copy.etaLabel, date, dday, caption };
}

export function etaFor(input: EtaInput): EtaView {
  const { data, key, events, config } = input;
  const copy = config.resultCopy;
  switch (config.stateGuide[key].etaMode) {
    case "none":
      return { kind: "none" };
    case "pendingInfo":
      return { kind: "pendingInfo", label: copy.etaLabel, text: copy.etaPendingText };
    case "withheld":
      return { kind: "withheld", label: copy.etaLabel, text: copy.etaWithheldText };
    case "deliveredOn": {
      const delivered = latestEvent(events, (item) => item.event.statusCode === 7) ?? latestEvent(events);
      const deliveredKey = delivered === null ? isoToKey(data.estimatedDeliveryDate) : kstDateKey(delivered.at);
      return deliveredKey === null
        ? { kind: "unknown", label: copy.etaDeliveredLabel, text: copy.etaUnknownText }
        : { kind: "deliveredOn", label: copy.etaDeliveredLabel, date: etaDate(deliveredKey) };
    }
    case "estimate":
      return estimateEta(input);
  }
}

/**
 * The '통관 완료 예상일' card (10월 2일 요청): the normalizer's clearance estimate (the same date as the caption), its D-day,
 * and — from the arrival (입항, code 1) day — how many customs working days and days off lie up to it. Customs waiting
 * states only and never once overdue, so it never contradicts the status card.
 */
export function customsEstimateFor(input: EtaInput): CustomsEstimateView | undefined {
  const { data, key, overdue, now, events, config } = input;
  if (overdue || !CUSTOMS_ESTIMATE_KEYS.has(key)) return undefined;
  const estimate = isoToKey(data.estimatedCustomsClearanceDate);
  if (estimate === null) return undefined;
  const today = kstDateKey(now);
  const arrivalEvent = events
    .filter((item) => item.source === "customs" && item.event.statusCode === 1)
    .reduce<TimedEvent | null>((earliest, item) => (earliest === null || item.at < earliest.at ? item : earliest), null);
  const arrivalKey = arrivalEvent === null ? null : kstDateKey(arrivalEvent.at);
  let businessDays = 0;
  let offDays = 0;
  if (arrivalKey !== null) {
    for (let day = addCalendarDays(arrivalKey, 1); day <= estimate; day = addCalendarDays(day, 1)) {
      if (isBusinessDay(day, config.calendar, "customs")) businessDays += 1;
      else offDays += 1;
    }
  }
  return {
    date: etaDate(estimate),
    dday: Math.max(0, calendarDaysBetween(today, estimate)),
    arrival: arrivalKey === null ? null : etaDate(arrivalKey),
    businessDays,
    offDays
  };
}
