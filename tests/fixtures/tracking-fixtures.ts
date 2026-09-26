/**
 * Shared test fixtures (roadmap §11.10). Frozen after S01: later stages add new fixture files instead of editing this one.
 * Every number here is fake. Real customer numbers must never appear in tests, docs or screens (spec §1, §4).
 */
import type { Page } from "@playwright/test";
import { getDeliveryCarrier } from "@/lib/delivery-carriers";
import { normalizeTrackingData } from "@/lib/services/normalizer";
import type {
  DeliveryCarrierCode,
  DeliveryLookupResult,
  StatusCode,
  TrackResponseData,
  TrackingEvent,
  TrackingType
} from "@/lib/types";

/** Saturday 26 September 2026, 14:05 KST — inside the 2026 Chuseok holidays (9/24–9/26). */
export const FIXTURE_NOW_ISO = "2026-09-26T14:05:00+09:00";
export const FIXTURE_NOW: Date = new Date(FIXTURE_NOW_ISO);

export const FAKE = {
  domestic: "000012345678", // '0000 1234 5678'
  domesticAlt: "000000000001", // '0000 0000 0001'
  domestic10: "0000123456",
  domestic14: "00001234567890", // '0000 1234 5678 90'
  hbl: "TEST00000001", // 'TEST 0000 0001'
  hblAlt: "ABCD00000000", // 'ABCD 0000 0000'
  cargo: "000012345678901234",
  invalidShort: "00001",
  invalidConfusable: "0000-0000-00O0",
  deepLinkInvalid: "ABCDE1", // alphanumeric 6–30, identifyTrackingNumber → UNKNOWN
  phone: "010-0000-1234"
} as const;

export const FAKE_GROUPED = {
  domestic: "0000 1234 5678",
  domesticAlt: "0000 0000 0001",
  hbl: "TEST 0000 0001",
  hblAlt: "ABCD 0000 0000"
} as const;

export type FixtureState =
  | "pending"
  | "customsArrived"
  | "customsWaiting"
  | "customsReview"
  | "customsCleared"
  | "handedToCarrier"
  | "pickedUp"
  | "inTransit"
  | "inTransitWithDriver"
  | "delivered"
  | "stale"
  | "lookupUnavailableAuto"
  | "lookupUnavailableCarrier"
  | "ambiguous"
  | "customsWithCarrierCut";

/** The 12 GAP3-06 variants. */
export const GAP3_06_VARIANTS: readonly FixtureState[] = [
  "pending",
  "customsArrived",
  "customsWaiting",
  "customsReview",
  "customsCleared",
  "pickedUp",
  "inTransit",
  "delivered",
  "stale",
  "lookupUnavailableAuto",
  "lookupUnavailableCarrier",
  "ambiguous"
];

const event = (
  status: string,
  statusCode: StatusCode,
  datetime: string,
  location: string,
  extra: Partial<TrackingEvent> = {}
): TrackingEvent => ({ status, statusCode, datetime, location, ...extra });

// Customs of a shipment that arrived this week (estimates land after Chuseok, 9/27 and 9/30).
const ARRIVED_THIS_WEEK = event("입항보고수리", 1, "2026-09-25T09:30:00+09:00", "인천공항");
const LISTED_TODAY = event("통관목록접수", 2, "2026-09-26T10:10:00+09:00", "인천공항세관");
const REVIEW_TODAY = event("심사진행", 3, "2026-09-26T11:40:00+09:00", "인천공항세관");

// Customs of a shipment cleared before Chuseok: code 4 on Wednesday 9/23 (spec §9 worry-date example).
const CLEARED_FLOW: readonly TrackingEvent[] = [
  event("입항보고수리", 1, "2026-09-21T08:40:00+09:00", "인천공항"),
  event("통관목록접수", 2, "2026-09-22T09:05:00+09:00", "인천공항세관"),
  event("수입신고수리", 4, "2026-09-23T14:10:00+09:00", "인천공항세관"),
  event("반출신고", 4, "2026-09-23T15:30:00+09:00", "인천공항세관")
];

// Domestic CJ events after clearance.
const HANDED_OVER = event("택배사 인계", 5, "2026-09-23T17:10:00+09:00", "인천GW");
const PICKED_UP = event("집화처리", 5, "2026-09-23T18:20:00+09:00", "인천GW", {
  detail: "보내시는 고객님으로부터 상품을 인수받았습니다"
});
const HUB = event("간선상차", 6, "2026-09-25T21:40:00+09:00", "곤지암Hub");
const OUT_FOR_DELIVERY = event("배송출발", 6, "2026-09-26T08:05:00+09:00", "서울강남", {
  driverName: "김배송",
  driverPhone: FAKE.phone
});
const DELIVERED = event("배송완료", 7, "2026-09-26T11:32:00+09:00", "서울강남");

// No event for 18 days (the normalizer marks > 14 days as stale).
const STALE_FLOW: readonly TrackingEvent[] = [
  event("통관목록접수", 2, "2026-09-02T10:00:00+09:00", "인천공항세관"),
  event("수입신고수리", 4, "2026-09-08T11:00:00+09:00", "인천공항세관")
];

type LookupHead = Omit<DeliveryLookupResult, "events">;

interface Recipe {
  readonly number: string;
  readonly type: TrackingType;
  readonly customs: readonly TrackingEvent[];
  readonly lookup: LookupHead;
  readonly deliveryEvents: readonly TrackingEvent[];
}

const autoLookup = (flags: Pick<LookupHead, "lookupUnavailable" | "ambiguous"> = {}): LookupHead => ({
  carrier: "국내택배 자동 조회",
  carrierCode: "AUTO",
  ...flags
});

const carrierLookup = (
  code: Exclude<DeliveryCarrierCode, "AUTO">,
  number: string,
  flags: Pick<LookupHead, "lookupUnavailable"> = {}
): LookupHead => ({
  carrier: getDeliveryCarrier(code).name,
  carrierCode: code,
  trackingUrl: getDeliveryCarrier(code).trackingUrl(number),
  ...flags
});

const hblRecipe = (
  customs: readonly TrackingEvent[],
  lookup: LookupHead,
  deliveryEvents: readonly TrackingEvent[] = []
): Recipe => ({ number: FAKE.hbl, type: "HBL", customs, lookup, deliveryEvents });

const domesticRecipe = (lookup: LookupHead): Recipe => ({
  number: FAKE.domestic,
  type: "DOMESTIC",
  customs: [],
  lookup,
  deliveryEvents: []
});

const CJ = carrierLookup("CJ", FAKE.hbl);

const RECIPES: Readonly<Record<FixtureState, Recipe>> = {
  pending: domesticRecipe(autoLookup()),
  customsArrived: hblRecipe([ARRIVED_THIS_WEEK], autoLookup()),
  customsWaiting: hblRecipe([ARRIVED_THIS_WEEK, LISTED_TODAY], autoLookup()),
  customsReview: hblRecipe([ARRIVED_THIS_WEEK, LISTED_TODAY, REVIEW_TODAY], autoLookup()),
  customsCleared: hblRecipe(CLEARED_FLOW, autoLookup()),
  handedToCarrier: hblRecipe(CLEARED_FLOW, CJ, [HANDED_OVER]),
  pickedUp: hblRecipe(CLEARED_FLOW, CJ, [HANDED_OVER, PICKED_UP]),
  inTransit: hblRecipe(CLEARED_FLOW, CJ, [HANDED_OVER, PICKED_UP, HUB]),
  inTransitWithDriver: hblRecipe(CLEARED_FLOW, CJ, [HANDED_OVER, PICKED_UP, HUB, OUT_FOR_DELIVERY]),
  delivered: hblRecipe(CLEARED_FLOW, CJ, [HANDED_OVER, PICKED_UP, HUB, OUT_FOR_DELIVERY, DELIVERED]),
  stale: hblRecipe(STALE_FLOW, autoLookup()),
  lookupUnavailableAuto: domesticRecipe(autoLookup({ lookupUnavailable: true })),
  lookupUnavailableCarrier: domesticRecipe(carrierLookup("HANJIN", FAKE.domestic, { lookupUnavailable: true })),
  ambiguous: domesticRecipe(autoLookup({ ambiguous: true })),
  customsWithCarrierCut: hblRecipe(CLEARED_FLOW, autoLookup({ lookupUnavailable: true }))
};

/** Built with the real normalizer at FIXTURE_NOW; every call returns fresh objects. `overrides` is a shallow merge. */
export function trackData(state: FixtureState, overrides: Partial<TrackResponseData> = {}): TrackResponseData {
  const recipe = RECIPES[state];
  const data = normalizeTrackingData({
    trackingNumber: recipe.number,
    type: recipe.type,
    customsEvents: recipe.customs.map((item) => ({ ...item })),
    deliveryLookup: { ...recipe.lookup, events: recipe.deliveryEvents.map((item) => ({ ...item })) },
    now: FIXTURE_NOW
  });
  return { ...data, ...overrides };
}

export type FailureFixture =
  | "invalid400"
  | "notFound404"
  | "rateLimited429"
  | "upstreamTimeout504"
  | "unavailable503"
  | "serverError500"
  | "badGatewayHtml502"
  | "contractViolation200";

interface CannedResponse {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
}

const JSON_TYPE = "application/json";
const errorBody = (code: string, message: string): string => JSON.stringify({ success: false, error: { code, message } });

/** Statuses, codes and messages exactly as app/api/track/route.ts sends them (the UI must never show the messages). */
export const FAILURE_RESPONSES: Readonly<Record<FailureFixture, CannedResponse>> = {
  invalid400: {
    status: 400,
    contentType: JSON_TYPE,
    body: errorBody(
      "INVALID_NUMBER",
      "입력하신 번호의 형식을 확인할 수 없습니다. HBL/화물관리번호/국내 운송장 번호를 다시 확인해주세요."
    )
  },
  notFound404: {
    status: 404,
    contentType: JSON_TYPE,
    body: errorBody("NOT_FOUND", "해당 번호로 통관/배송 정보를 찾을 수 없습니다")
  },
  rateLimited429: {
    status: 429,
    contentType: JSON_TYPE,
    body: errorBody("RATE_LIMITED", "조회 요청이 많습니다. 잠시 후 다시 시도해주세요")
  },
  upstreamTimeout504: {
    status: 504,
    contentType: JSON_TYPE,
    body: errorBody("API_TIMEOUT", "조회 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요")
  },
  unavailable503: {
    status: 503,
    contentType: JSON_TYPE,
    body: errorBody(
      "API_TIMEOUT",
      "현재 택배사 조회 시스템 점검으로 배송정보 조회가 지연되고 있습니다. 잠시 후 다시 시도해주세요"
    )
  },
  serverError500: {
    status: 500,
    contentType: JSON_TYPE,
    body: errorBody("SERVER_ERROR", "시스템 오류가 발생했습니다. 관리자에게 문의해주세요")
  },
  badGatewayHtml502: {
    status: 502,
    contentType: "text/html; charset=utf-8",
    body: "<html><body><h1>502 Bad Gateway</h1></body></html>"
  },
  contractViolation200: {
    status: 200,
    contentType: JSON_TYPE,
    body: JSON.stringify({ success: true, data: { trackingNumber: FAKE.domestic } })
  }
};

/** JSON body of a successful /api/track response: { success: true, data }. */
export function successBody(data: TrackResponseData): string {
  return JSON.stringify({ success: true, data });
}

/** Answers every POST /api/track on `page` with `response`; other methods fall through. */
export async function mockTrack(
  page: Page,
  response: TrackResponseData | FailureFixture,
  options: { readonly delayMs?: number; readonly onRequest?: (body: unknown) => void } = {}
): Promise<void> {
  const reply: CannedResponse =
    typeof response === "string"
      ? FAILURE_RESPONSES[response]
      : { status: 200, contentType: JSON_TYPE, body: successBody(response) };

  await page.route("**/api/track", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.fallback();
      return;
    }
    const body: unknown = request.postDataJSON();
    options.onRequest?.(body);
    const delayMs = options.delayMs ?? 0;
    if (delayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    try {
      await route.fulfill(reply);
    } catch (error) {
      // During delayMs the page may have navigated or closed, so this request no longer exists. Anything else is a real failure.
      if (!(error instanceof Error) || !/closed|disposed|already handled/i.test(error.message)) throw error;
    }
  });
}
