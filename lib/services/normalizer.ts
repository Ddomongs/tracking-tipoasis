import type { DeliveryResult, StatusCode, TimelineStep, TrackResponseData, TrackingEvent, TrackingType } from "@/lib/types";

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

const getLatestEventByStatusCode = (events: TrackingEvent[], statusCode: StatusCode): TrackingEvent | undefined =>
  events
    .filter((event) => event.statusCode === statusCode)
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0];

const addDaysIso = (isoLike: string, days: number): string => {
  const base = new Date(isoLike);
  if (Number.isNaN(base.getTime())) {
    return new Date().toISOString();
  }

  base.setDate(base.getDate() + days);
  return base.toISOString();
};

const estimateDeliveryDate = (
  deliveryEvents: TrackingEvent[],
  customsEvents: TrackingEvent[],
  currentStatusCode: StatusCode
): string | undefined => {
  const latestDelivery = getLastDatetime(deliveryEvents);
  const latestCustoms = getLastDatetime(customsEvents);
  const reference = latestDelivery || latestCustoms;

  if (!reference) {
    return undefined;
  }

  if (currentStatusCode === 7) {
    return latestDelivery || reference;
  }

  if (currentStatusCode === 6) {
    return addDaysIso(reference, 1);
  }

  if (currentStatusCode === 5) {
    return addDaysIso(reference, 2);
  }

  return addDaysIso(reference, 3);
};

export const normalizeTrackingData = (params: {
  trackingNumber: string;
  type: TrackingType;
  customsEvents: TrackingEvent[];
  deliveryEvents: TrackingEvent[];
}): TrackResponseData => {
  const { trackingNumber, type, customsEvents, deliveryEvents } = params;
  const trackingEvents = [...customsEvents, ...deliveryEvents];
  const hasTrackingEvents = trackingEvents.length > 0;
  const isPendingDomestic = type === "DOMESTIC" && !hasTrackingEvents;
  const latestStatusCode = trackingEvents.map((event) => event.statusCode).sort((a, b) => b - a)[0] ?? 1;

  const currentStatusCode = (isPendingDomestic ? 5 : latestStatusCode) as StatusCode;

  const latestCurrentEvent = getLatestEventByStatusCode(trackingEvents, currentStatusCode);
  const currentStatus = isPendingDomestic ? "배송정보 대기" : latestCurrentEvent?.status ?? LABEL_BY_STEP[currentStatusCode];

  const orderedSteps: StatusCode[] = [1, 2, 3, 4, 5, 6, 7];

  const timeline: TimelineStep[] = orderedSteps.map((step) => {
    const matched = trackingEvents
      .filter((event) => event.statusCode === step)
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())[0];

    return {
      step,
      label: LABEL_BY_STEP[step],
      completed: hasTrackingEvents && step <= currentStatusCode,
      datetime: matched?.datetime
    };
  });

  const delivery: DeliveryResult = {
    carrier: "CJ대한통운",
    carrierCode: "04",
    invoiceNumber: trackingNumber,
    events: deliveryEvents
  };

  const lastUpdated =
    getLastDatetime(deliveryEvents) || getLastDatetime(customsEvents) || new Date().toISOString();
  const estimatedDeliveryDate = isPendingDomestic
    ? undefined
    : estimateDeliveryDate(deliveryEvents, customsEvents, currentStatusCode);

  return {
    trackingNumber,
    type,
    currentStatus,
    currentStatusCode,
    isPending: isPendingDomestic || undefined,
    estimatedDeliveryDate,
    customs: { events: customsEvents },
    delivery,
    timeline,
    lastUpdated
  };
};
