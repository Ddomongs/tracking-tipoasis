import { calendar as siteCalendar } from "@/config/site.config";
import type { CalendarConfig } from "@/lib/config/types";
import { countedDaysAfter, isCarrierDeliveryDay } from "@/lib/tracking/delivery-days";
import { calendarDaysBetween, isBusinessDay, kstDateKey, type KstDateKey } from "@/lib/tracking/time";
import type {
  CustomsCargoInfo,
  DeliveryLookupResult,
  DeliveryResult,
  StatusCode,
  TimelineStep,
  TrackResponseData,
  TrackingEvent,
  TrackingType
} from "@/lib/types";

const LABEL_BY_STEP: Record<StatusCode, string> = {
  1: "입항",
  2: "통관 접수",
  3: "통관 심사중",
  4: "통관 완료",
  5: "국내 배송 인계",
  6: "배송중",
  7: "배송완료"
};

const getLastDatetime = (events: TrackingEvent[]): string | undefined => {
  if (events.length === 0) return undefined;
  return events[events.length - 1]?.datetime;
};

const getLatestDatetime = (values: Array<string | undefined>): string | undefined =>
  values
    .filter((value): value is string => typeof value === "string" && !Number.isNaN(new Date(value).getTime()))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

const getLatestEventByStatusCode = (events: TrackingEvent[], statusCode: StatusCode): TrackingEvent | undefined =>
  events
    .filter((event) => event.statusCode === statusCode)
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0];

const addDaysIso = (isoLike: string, days: number): string => {
  const base = new Date(isoLike);
  if (Number.isNaN(base.getTime())) {
    return new Date().toISOString();
  }

  return new Date(base.getTime() + days * 86_400_000).toISOString();
};

/**
 * `isoLike` moved forward by `count` days that `counts` accepts, keeping its time of day (10월 4일 요청: the estimate
 * skips the days nobody works instead of plain calendar days).
 */
const addCountedDaysIso = (isoLike: string, count: number, counts: (key: KstDateKey) => boolean): string => {
  const base = new Date(isoLike);
  if (Number.isNaN(base.getTime())) return addDaysIso(isoLike, count);
  const startKey = kstDateKey(base);
  return addDaysIso(isoLike, calendarDaysBetween(startKey, countedDaysAfter(startKey, count, counts)));
};

const getKoreaDateKey = (date: Date): number => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(`${values.year}${values.month}${values.day}`);
};

const getKoreaTodayIso = (now: Date): string => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T00:00:00+09:00`;
};

/** Shipments with no new event for this long stop getting a computed estimate. */
const STALE_AFTER_DAYS = 14;

const isStaleShipment = (latestEventIso: string | undefined, currentStatusCode: StatusCode, now: Date): boolean => {
  if (currentStatusCode === 7 || !latestEventIso) return false;
  const latest = new Date(latestEventIso);
  if (Number.isNaN(latest.getTime())) return false;
  return now.getTime() - latest.getTime() > STALE_AFTER_DAYS * 86_400_000;
};

type EstimatedDate = {
  date?: string;
  adjusted: boolean;
};

const adjustPastEstimate = (isoText: string | undefined, now: Date): EstimatedDate => {
  if (!isoText) return { adjusted: false };
  const target = new Date(isoText);
  if (Number.isNaN(target.getTime())) return { adjusted: false };
  if (getKoreaDateKey(target) >= getKoreaDateKey(now)) return { date: isoText, adjusted: false };
  return { date: getKoreaTodayIso(now), adjusted: true };
};

const estimateDeliveryDate = (
  deliveryEvents: TrackingEvent[],
  customsEvents: TrackingEvent[],
  currentStatusCode: StatusCode,
  customsEstimate: string | undefined,
  now: Date,
  deliveryDay: (key: KstDateKey) => boolean
): string | undefined => {
  const latestDelivery = getLastDatetime(deliveryEvents);
  const latestCustoms = getLastDatetime(customsEvents);
  const reference = latestDelivery || customsEstimate || latestCustoms;

  if (!reference) {
    return undefined;
  }

  if (currentStatusCode === 7) {
    return latestDelivery || reference;
  }

  if (currentStatusCode === 6) {
    return adjustPastEstimate(addCountedDaysIso(reference, 1, deliveryDay), now).date;
  }

  if (currentStatusCode === 5) {
    return adjustPastEstimate(addCountedDaysIso(reference, 2, deliveryDay), now).date;
  }

  // Customs waiting or cleared: parcels reach the customer 1–2 delivery days after clearance; the estimate takes the
  // later day (11월 28일 요청: the arrival date had sat three days after the clearance estimate).
  return adjustPastEstimate(addCountedDaysIso(reference, 2, deliveryDay), now).date;
};

const estimateCustomsClearanceDate = (
  customsEvents: TrackingEvent[],
  currentStatusCode: StatusCode,
  now: Date,
  calendar: CalendarConfig,
  cargo?: CustomsCargoInfo
): ClearanceWindow => {
  const completedEvent = getLatestEventByStatusCode(customsEvents, 4);
  if (currentStatusCode >= 4) {
    return { date: completedEvent?.datetime, adjusted: false };
  }

  const latestCustoms = getLastDatetime(customsEvents);
  if (!latestCustoms) {
    return { adjusted: false };
  }

  const remainingDaysByStatus: Record<1 | 2 | 3, number> = {
    1: 2,
    2: 1,
    3: 1
  };

  // Customs counts working days, unless this shipment already moved on a weekend or holiday (10월 4일 요청: some
  // bonded areas work then) — then every day counts.
  const movedOnDayOff = customsEvents.some((event) => {
    const at = new Date(event.datetime);
    return !Number.isNaN(at.getTime()) && !isBusinessDay(kstDateKey(at), calendar, "customs");
  });
  const counts = (key: KstDateKey): boolean => movedOnDayOff || isBusinessDay(key, calendar, "customs");
  const fromArrival = clearanceWindowFromArrival(cargo, now, counts);
  if (fromArrival !== undefined) return fromArrival;
  return adjustPastEstimate(
    addCountedDaysIso(latestCustoms, remainingDaysByStatus[currentStatusCode as 1 | 2 | 3], counts),
    now
  );
};

/**
 * Customs working days after the arrival day (입항일) to the early and late end of the clearance window
 * (11월 27일 요청: 7customs-like '빠르면 / 늦으면'). Sea cargo waits for unloading and warehouse entry; air is faster.
 */
const CLEARANCE_WINDOW = {
  sea: { fastest: 2, latest: 3 },
  air: { fastest: 1, latest: 2 }
} as const;

type ClearanceWindow = EstimatedDate & { latest?: string };

const kstMidnightIso = (key: KstDateKey): string => `${key}T00:00:00+09:00`;

/** The later of two ISO instants by KST day. */
const laterDay = (a: string, b: string): string => (kstDateKey(new Date(a)) >= kstDateKey(new Date(b)) ? a : b);

/**
 * From the official arrival day: the window by transport mode, then the batch (cargo of the same master BL) moves the
 * early end — today when customs is clearing the batch today, not before the next working day while none of it is
 * cleared. Undefined when the arrival day is unknown (the caller keeps the older latest-event rule).
 */
const clearanceWindowFromArrival = (
  cargo: CustomsCargoInfo | undefined,
  now: Date,
  counts: (key: KstDateKey) => boolean
): ClearanceWindow | undefined => {
  if (cargo?.arrivalDate === undefined) return undefined;
  const window = cargo.bySea === false ? CLEARANCE_WINDOW.air : CLEARANCE_WINDOW.sea;
  const after = (start: KstDateKey, count: number): string => kstMidnightIso(countedDaysAfter(start, count, counts));
  const today = kstDateKey(now);
  const scheduled = after(cargo.arrivalDate, window.fastest);
  const batch = cargo.batch;
  const clearingToday = batch !== undefined && batch.clearedToday > 0;
  const nothingCleared = batch !== undefined && batch.cleared === 0;
  // The first day customs can still clear it: today if it is clearing this batch now, else today only when today is a
  // customs working day and some of the batch is already cleared, otherwise the next working day (11월 28일: a passed
  // estimate showed Saturday as '빠르면').
  const floor = clearingToday || (counts(today) && !nothingCleared) ? kstMidnightIso(today) : after(today, 1);
  const fastest = clearingToday ? floor : laterDay(scheduled, floor);
  const early: EstimatedDate = { date: fastest, adjusted: kstDateKey(new Date(scheduled)) < today };
  const latest = laterDay(after(cargo.arrivalDate, window.latest), fastest);
  return { ...early, ...(latest === fastest ? {} : { latest }) };
};

const PRODUCT_NAME_MAX = 60;

/** The first item name customs gave, with spaces tidied and cut to 60 characters (10월 2일 요청: 상품명 표시). */
const productNameOf = (events: readonly TrackingEvent[], cargo?: CustomsCargoInfo): string | undefined => {
  const raw = [cargo?.productName, ...events.map((event) => event.productName)].find((name) => (name ?? "").trim().length > 0);
  if (raw === undefined) return undefined;
  const tidy = raw.replace(/\s+/g, " ").trim();
  return [...tidy].length > PRODUCT_NAME_MAX ? `${[...tidy].slice(0, PRODUCT_NAME_MAX - 1).join("")}…` : tidy;
};

const withoutProductName = (event: TrackingEvent): TrackingEvent => {
  if (event.productName === undefined) return event;
  const rest: TrackingEvent = { ...event };
  delete rest.productName;
  return rest;
};

export const normalizeTrackingData = (params: {
  trackingNumber: string;
  type: TrackingType;
  customsEvents: TrackingEvent[];
  deliveryLookup: DeliveryLookupResult;
  now?: Date;
  calendar?: CalendarConfig;
  /** UNI-PASS summary facts (arrival day, mode, batch progress); absent for customstrack or carrier-only answers. */
  cargo?: CustomsCargoInfo;
}): TrackResponseData => {
  const { trackingNumber, type, deliveryLookup, now = new Date(), calendar = siteCalendar, cargo } = params;
  const productName = productNameOf(params.customsEvents, cargo);
  const customsEvents = params.customsEvents.map(withoutProductName);
  const deliveryEvents = deliveryLookup.events;
  const trackingEvents = [...customsEvents, ...deliveryEvents];
  const hasTrackingData = trackingEvents.length > 0;
  const isLookupUnavailable = deliveryLookup.lookupUnavailable === true && !hasTrackingData;
  const isAmbiguous = deliveryLookup.ambiguous === true && !hasTrackingData;
  const isPendingDomestic = type === "DOMESTIC" && !hasTrackingData && !isLookupUnavailable && !isAmbiguous;
  const latestStatusCode: StatusCode = trackingEvents.map((event) => event.statusCode).sort((a, b) => b - a)[0] ?? 1;

  const currentStatusCode: StatusCode = isPendingDomestic ? 1 : latestStatusCode;

  const latestCurrentEvent = getLatestEventByStatusCode(trackingEvents, currentStatusCode);
  const currentStatus = isAmbiguous
    ? "택배사 선택 필요"
    : isLookupUnavailable
      ? "조회 지연"
      : isPendingDomestic
        ? "도착전"
        : latestCurrentEvent?.status ?? LABEL_BY_STEP[currentStatusCode];

  const orderedSteps: StatusCode[] = [1, 2, 3, 4, 5, 6, 7];

  const timeline: TimelineStep[] = orderedSteps.map((step) => {
    const matched = trackingEvents
      .filter((event) => event.statusCode === step)
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())[0];

    return {
      step,
      label: LABEL_BY_STEP[step],
      completed: hasTrackingData && step <= currentStatusCode,
      datetime: matched?.datetime
    };
  });

  const delivery: DeliveryResult = {
    carrier: deliveryLookup.carrier,
    carrierCode: deliveryLookup.carrierCode,
    invoiceNumber: trackingNumber,
    trackingUrl: deliveryLookup.trackingUrl,
    lookupUnavailable: deliveryLookup.lookupUnavailable,
    ambiguous: deliveryLookup.ambiguous,
    events: deliveryEvents
  };

  const lastUpdated =
    getLatestDatetime([getLastDatetime(deliveryEvents), getLastDatetime(customsEvents)]) ?? now.toISOString();
  const latestEventIso = getLatestDatetime([getLastDatetime(deliveryEvents), getLastDatetime(customsEvents)]);
  const estimateStale = hasTrackingData && isStaleShipment(latestEventIso, currentStatusCode, now);
  const rawCustomsEstimate = estimateCustomsClearanceDate(customsEvents, currentStatusCode, now, calendar, cargo);
  // Once a shipment goes quiet, a recalculated "today" estimate misleads; keep only real dates.
  const customsEstimate: ClearanceWindow =
    estimateStale && rawCustomsEstimate.adjusted ? { adjusted: false } : rawCustomsEstimate;
  const estimatedDeliveryDate =
    isPendingDomestic || estimateStale
      ? undefined
      : estimateDeliveryDate(deliveryEvents, customsEvents, currentStatusCode, customsEstimate.date, now, (key) =>
          isCarrierDeliveryDay(key, calendar, deliveryLookup.carrierCode)
        );
  const estimatedCustomsClearanceDate = customsEstimate.date;

  return {
    trackingNumber,
    type,
    currentStatus,
    currentStatusCode,
    isPending: isPendingDomestic || undefined,
    estimatedCustomsClearanceDate,
    ...(customsEstimate.latest === undefined ? {} : { estimatedCustomsClearanceLatest: customsEstimate.latest }),
    ...(productName === undefined ? {} : { productName }),
    estimatedDeliveryDate,
    estimateStale: estimateStale || undefined,
    customs: {
      events: customsEvents,
      estimateAdjusted: customsEstimate.adjusted || undefined,
      ...(cargo?.arrivalDate === undefined ? {} : { arrivalDate: kstMidnightIso(cargo.arrivalDate) }),
      ...(cargo?.batch === undefined || currentStatusCode >= 4 ? {} : { batch: cargo.batch })
    },
    delivery,
    timeline,
    lastUpdated
  };
};
