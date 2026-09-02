import type {
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
  now: Date
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
    return adjustPastEstimate(addDaysIso(reference, 1), now).date;
  }

  if (currentStatusCode === 5) {
    return adjustPastEstimate(addDaysIso(reference, 2), now).date;
  }

  return adjustPastEstimate(addDaysIso(reference, 3), now).date;
};

const estimateCustomsClearanceDate = (
  customsEvents: TrackingEvent[],
  currentStatusCode: StatusCode,
  now: Date
): EstimatedDate => {
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

  return adjustPastEstimate(
    addDaysIso(latestCustoms, remainingDaysByStatus[currentStatusCode as 1 | 2 | 3]),
    now
  );
};

export const normalizeTrackingData = (params: {
  trackingNumber: string;
  type: TrackingType;
  customsEvents: TrackingEvent[];
  deliveryLookup: DeliveryLookupResult;
  now?: Date;
}): TrackResponseData => {
  const { trackingNumber, type, customsEvents, deliveryLookup, now = new Date() } = params;
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
  const rawCustomsEstimate = estimateCustomsClearanceDate(customsEvents, currentStatusCode, now);
  // Once a shipment goes quiet, a recalculated "today" estimate misleads; keep only real dates.
  const customsEstimate: EstimatedDate =
    estimateStale && rawCustomsEstimate.adjusted ? { adjusted: false } : rawCustomsEstimate;
  const estimatedDeliveryDate =
    isPendingDomestic || estimateStale
      ? undefined
      : estimateDeliveryDate(deliveryEvents, customsEvents, currentStatusCode, customsEstimate.date, now);
  const estimatedCustomsClearanceDate = customsEstimate.date;

  return {
    trackingNumber,
    type,
    currentStatus,
    currentStatusCode,
    isPending: isPendingDomestic || undefined,
    estimatedCustomsClearanceDate,
    estimatedDeliveryDate,
    estimateStale: estimateStale || undefined,
    customs: {
      events: customsEvents,
      estimateAdjusted: customsEstimate.adjusted || undefined
    },
    delivery,
    timeline,
    lastUpdated
  };
};
