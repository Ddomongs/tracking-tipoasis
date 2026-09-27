import { normalizeTrackingData } from "@/lib/services/normalizer";
import type { FailureCause, LookupOutcome, LookupRequest } from "@/lib/tracking/types";
import type { DeliveryCarrierCode, DeliveryLookupResult, StatusCode, TrackResponseData, TrackingEvent } from "@/lib/types";
import { FAKE, FIXTURE_NOW } from "./tracking-fixtures";

/** Explicit, hand-checked inputs for the per-state rows of derive-view.spec.ts and cs-reply.spec.ts (2026 dates, 추석 9/24–26). */
export const CJ_URL = `https://trace.cjlogistics.com/next/tracking.html?wblNo=${FAKE.domestic}`;
export const OCTOBER_NOW = new Date("2026-10-14T10:00:00+09:00"); // Wednesday, no holiday nearby
export const PICKUP_NOW = new Date("2026-10-08T18:00:00+09:00");  // the day before 한글날
export const MOVED_NOW = new Date("2026-09-22T12:00:00+09:00");

export function ev(
  status: string, statusCode: StatusCode, datetime: string, location?: string, extra: Partial<TrackingEvent> = {}
): TrackingEvent {
  return { status, statusCode, datetime, ...(location === undefined ? {} : { location }), ...extra };
}

export const AUTO_LOOKUP: DeliveryLookupResult = { carrier: "택배사 자동 확인", carrierCode: "AUTO", events: [] };

export function cjLookup(
  events: readonly TrackingEvent[], flags: { readonly lookupUnavailable?: boolean; readonly ambiguous?: boolean } = {}
): DeliveryLookupResult {
  return { carrier: "CJ대한통운", carrierCode: "CJ", trackingUrl: CJ_URL, events: [...events], ...flags };
}

const SEPTEMBER_CLEARED = [
  ev("입항", 1, "2026-09-22T08:40:00+09:00", "인천공항"),
  ev("통관목록접수", 2, "2026-09-22T14:12:00+09:00", "인천공항세관"),
  ev("수입신고수리", 4, "2026-09-23T10:05:00+09:00", "인천공항세관")
];
const OCTOBER_CUSTOMS = [
  ev("통관목록접수", 2, "2026-10-06T10:00:00+09:00", "인천공항세관"),
  ev("수입신고수리", 4, "2026-10-07T11:00:00+09:00", "인천공항세관")
];
const PICKUP = ev("집화처리", 5, "2026-10-08T17:00:00+09:00", "인천GW", { detail: "보내시는 고객님으로부터 상품을 인수받았습니다" });

/** HBL, code 1 only (입항 9/25 21:00). */
export function customsArrivedData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.hbl, type: "HBL", customsEvents: [ev("입항", 1, "2026-09-25T21:00:00+09:00", "인천공항")],
    deliveryLookup: AUTO_LOOKUP, now: FIXTURE_NOW
  });
}

/** HBL, code 2 (통관목록접수 9/23 14:10); the server moves the customs estimate to 9/26. */
export function customsWaitingData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.hbl, type: "HBL",
    customsEvents: [ev("입항", 1, "2026-09-22T08:40:00+09:00", "인천공항"), ev("통관목록접수", 2, "2026-09-23T14:10:00+09:00", "인천공항세관")],
    deliveryLookup: AUTO_LOOKUP, now: FIXTURE_NOW
  });
}

/** HBL, code 3, recent. */
export function customsReviewData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.hbl, type: "HBL",
    customsEvents: [
      ev("입항", 1, "2026-09-24T21:00:00+09:00", "인천공항"),
      ev("통관목록접수", 2, "2026-09-25T10:00:00+09:00", "인천공항세관"),
      ev("통관목록심사", 3, "2026-09-25T15:00:00+09:00", "인천공항세관")
    ],
    deliveryLookup: AUTO_LOOKUP, now: FIXTURE_NOW
  });
}

/** Domestic, code 4 on 9/23 10:05 (spec example: handoff worry date 9/29). */
export function customsClearedData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: SEPTEMBER_CLEARED, deliveryLookup: AUTO_LOOKUP, now: FIXTURE_NOW
  });
}

/** Customs events plus a carrier lookup that timed out (code-based state with a cut spine). */
export function carrierCutData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: SEPTEMBER_CLEARED,
    deliveryLookup: cjLookup([], { lookupUnavailable: true }), now: FIXTURE_NOW
  });
}

export function pickedUpData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: OCTOBER_CUSTOMS, deliveryLookup: cjLookup([PICKUP]), now: PICKUP_NOW
  });
}

export function handedToCarrierData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: OCTOBER_CUSTOMS,
    deliveryLookup: cjLookup([ev("간선상차", 5, "2026-10-08T17:00:00+09:00", "인천GW")]), now: PICKUP_NOW
  });
}

/** Code 6 out for delivery on 10/12 08:15 with a driver phone; read on 10/14 (estimate moved to today). */
export function inTransitData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: OCTOBER_CUSTOMS,
    deliveryLookup: cjLookup([PICKUP, ev("배송출발", 6, "2026-10-12T08:15:00+09:00", "서울강남", { driverPhone: FAKE.phone })]),
    now: OCTOBER_NOW
  });
}

export function pendingData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: [], deliveryLookup: AUTO_LOOKUP, now: FIXTURE_NOW
  });
}

export function deliveredData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC",
    customsEvents: [ev("수입신고수리", 4, "2026-09-23T10:05:00+09:00", "인천공항세관")],
    deliveryLookup: cjLookup([
      ev("집화처리", 5, "2026-09-24T09:00:00+09:00", "인천GW"),
      ev("배송출발", 6, "2026-09-25T08:00:00+09:00", "서울강남"),
      ev("배송완료", 7, "2026-09-25T14:32:00+09:00", "문 앞")
    ]),
    now: FIXTURE_NOW
  });
}

/** Last event 9/6 10:00, 20 days before FIXTURE_NOW → estimateStale. */
export function staleData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC",
    customsEvents: [ev("통관목록접수", 2, "2026-09-05T09:00:00+09:00", "인천공항세관"), ev("통관목록심사", 3, "2026-09-06T10:00:00+09:00", "인천공항세관")],
    deliveryLookup: AUTO_LOOKUP, now: FIXTURE_NOW
  });
}

export function lookupUnavailableData(carrier: "AUTO" | "CJ"): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: [],
    deliveryLookup: carrier === "CJ" ? cjLookup([], { lookupUnavailable: true }) : { ...AUTO_LOOKUP, lookupUnavailable: true },
    now: FIXTURE_NOW
  });
}

export function ambiguousData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: [], deliveryLookup: { ...AUTO_LOOKUP, ambiguous: true }, now: FIXTURE_NOW
  });
}

/** 통관목록접수 9/15 read on 9/22: the server moved the customs estimate from 9/16 to 9/22. */
export function movedEstimateData(): TrackResponseData {
  return normalizeTrackingData({
    trackingNumber: FAKE.domestic, type: "DOMESTIC",
    customsEvents: [ev("통관목록접수", 2, "2026-09-15T10:00:00+09:00", "인천공항세관")],
    deliveryLookup: AUTO_LOOKUP, now: MOVED_NOW
  });
}

export function request(number: string, carrier: DeliveryCarrierCode = "AUTO"): LookupRequest {
  return { number, carrier, entry: "manual" };
}

export function success(data: TrackResponseData, carrier: DeliveryCarrierCode = "AUTO"): LookupOutcome {
  return { kind: "success", request: request(data.trackingNumber, carrier), data };
}

export function failure(
  cause: FailureCause,
  options: { readonly consecutiveFailures?: number; readonly carrier?: DeliveryCarrierCode; readonly number?: string } = {}
): LookupOutcome {
  return {
    kind: "failure",
    request: request(options.number ?? FAKE.domestic, options.carrier ?? "AUTO"),
    cause,
    consecutiveFailures: options.consecutiveFailures ?? 1
  };
}
