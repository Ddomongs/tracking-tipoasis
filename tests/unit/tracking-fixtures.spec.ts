import { expect, test, type Page, type Route } from "@playwright/test";
import { getDeliveryCarrier } from "@/lib/delivery-carriers";
import { ApiTrackResponseSchema, TrackResponseDataSchema } from "@/lib/schemas";
import { identifyTrackingNumber } from "@/lib/services/identifier";
import type { StatusCode, TrackingType } from "@/lib/types";
import {
  FAILURE_RESPONSES,
  FAKE,
  FAKE_GROUPED,
  FIXTURE_NOW,
  FIXTURE_NOW_ISO,
  GAP3_06_VARIANTS,
  mockTrack,
  successBody,
  trackData,
  type FixtureState
} from "../fixtures/tracking-fixtures";

const STATE_TABLE: ReadonlyArray<readonly [FixtureState, TrackingType, StatusCode, string]> = [
  ["pending", "DOMESTIC", 1, "도착전"],
  ["customsArrived", "HBL", 1, "입항보고수리"],
  ["customsWaiting", "HBL", 2, "통관목록접수"],
  ["customsReview", "HBL", 3, "심사진행"],
  ["customsCleared", "HBL", 4, "반출신고"],
  ["handedToCarrier", "HBL", 5, "택배사 인계"],
  ["pickedUp", "HBL", 5, "집화처리"],
  ["inTransit", "HBL", 6, "간선상차"],
  ["inTransitWithDriver", "HBL", 6, "배송출발"],
  ["delivered", "HBL", 7, "배송완료"],
  ["stale", "HBL", 4, "수입신고수리"],
  ["lookupUnavailableAuto", "DOMESTIC", 1, "조회 지연"],
  ["lookupUnavailableCarrier", "DOMESTIC", 1, "조회 지연"],
  ["ambiguous", "DOMESTIC", 1, "택배사 선택 필요"],
  ["customsWithCarrierCut", "HBL", 4, "반출신고"]
];

test("the fixture clock is Saturday 26 September 2026, 14:05 KST", () => {
  expect(FIXTURE_NOW_ISO).toBe("2026-09-26T14:05:00+09:00");
  expect(FIXTURE_NOW.toISOString()).toBe("2026-09-26T05:05:00.000Z");
});

test("fake numbers have the formats their names promise", () => {
  const typeOf = (value: string): string => identifyTrackingNumber(value).type;
  expect([FAKE.domestic, FAKE.domesticAlt, FAKE.domestic10, FAKE.domestic14].map(typeOf)).toEqual([
    "DOMESTIC",
    "DOMESTIC",
    "DOMESTIC",
    "DOMESTIC"
  ]);
  expect([FAKE.hbl, FAKE.hblAlt].map(typeOf)).toEqual(["HBL", "HBL"]);
  expect(typeOf(FAKE.cargo)).toBe("CARGO");
  expect([FAKE.invalidShort, FAKE.invalidConfusable, FAKE.deepLinkInvalid].map(typeOf)).toEqual([
    "UNKNOWN",
    "UNKNOWN",
    "UNKNOWN"
  ]);
  expect(FAKE.phone).toBe("010-0000-1234");
  expect(FAKE_GROUPED).toEqual({
    domestic: "0000 1234 5678",
    domesticAlt: "0000 0000 0001",
    hbl: "TEST 0000 0001",
    hblAlt: "ABCD 0000 0000"
  });
  for (const key of ["domestic", "domesticAlt", "hbl", "hblAlt"] as const) {
    expect(FAKE_GROUPED[key].replace(/ /g, "")).toBe(FAKE[key]);
  }
});

test("every fixture state is valid API data with the expected code and status", () => {
  expect(new Set(STATE_TABLE.map(([state]) => state)).size).toBe(15);
  for (const [state, type, code, status] of STATE_TABLE) {
    const data = trackData(state);
    expect(TrackResponseDataSchema.safeParse(data).success, state).toBe(true);
    expect([data.type, data.currentStatusCode, data.currentStatus], state).toEqual([type, code, status]);
    const events = [...data.customs.events, ...data.delivery.events];
    expect(
      events.every((item) => Date.parse(item.datetime) <= FIXTURE_NOW.getTime()),
      `${state}: no event after FIXTURE_NOW`
    ).toBe(true);
  }
});

test("fixture states carry the flags later stages branch on", () => {
  const pending = trackData("pending");
  expect(pending.isPending).toBe(true);
  expect(pending.estimatedDeliveryDate).toBeUndefined();
  const stale = trackData("stale");
  expect(stale.estimateStale).toBe(true);
  expect(stale.estimatedDeliveryDate).toBeUndefined();
  expect(trackData("lookupUnavailableAuto").delivery).toMatchObject({ carrierCode: "AUTO", lookupUnavailable: true, events: [] });
  expect(trackData("lookupUnavailableCarrier").delivery).toMatchObject({
    carrier: "한진택배",
    carrierCode: "HANJIN",
    lookupUnavailable: true,
    trackingUrl: getDeliveryCarrier("HANJIN").trackingUrl(FAKE.domestic)
  });
  expect(trackData("ambiguous").delivery).toMatchObject({ carrierCode: "AUTO", ambiguous: true, events: [] });
  const cut = trackData("customsWithCarrierCut");
  expect(cut.delivery.lookupUnavailable).toBe(true);
  expect([cut.customs.events.length, cut.delivery.events.length]).toEqual([4, 0]);
  expect(trackData("inTransitWithDriver").delivery.events.at(-1)).toMatchObject({ status: "배송출발", driverPhone: FAKE.phone });
  expect(trackData("delivered").delivery).toMatchObject({ carrier: "CJ대한통운", carrierCode: "CJ" });
});

test("fixture estimates are fixed by FIXTURE_NOW", () => {
  expect(trackData("customsWaiting")).toMatchObject({
    estimatedCustomsClearanceDate: "2026-09-27T01:10:00.000Z",
    estimatedDeliveryDate: "2026-09-30T01:10:00.000Z"
  });
  expect(trackData("customsCleared")).toMatchObject({
    estimatedCustomsClearanceDate: "2026-09-23T15:30:00+09:00",
    // 10월 4일 요청: no delivery on 추석 (9/24–26) or Sunday 9/27, so 9/28, 9/29, 9/30.
    estimatedDeliveryDate: "2026-09-30T06:30:00.000Z"
  });
  // CJ rests on 추석 (9/26) and delivers on Sunday 9/27 (10월 4일 요청).
  expect(trackData("inTransit").estimatedDeliveryDate).toBe("2026-09-27T12:40:00.000Z");
  expect(trackData("delivered").estimatedDeliveryDate).toBe("2026-09-26T11:32:00+09:00");
  expect(trackData("stale").lastUpdated).toBe("2026-09-08T11:00:00+09:00");
});

test("GAP3-06 variants, overrides and fresh copies", () => {
  expect(GAP3_06_VARIANTS).toEqual([
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
  ]);
  expect(trackData("pending", { trackingNumber: FAKE.domesticAlt }).trackingNumber).toBe(FAKE.domesticAlt);
  const first = trackData("inTransit");
  first.delivery.events.pop();
  expect(trackData("inTransit").delivery.events).toHaveLength(3);
});

test("failure responses mirror what /api/track sends", () => {
  const statuses = Object.fromEntries(Object.entries(FAILURE_RESPONSES).map(([name, reply]) => [name, reply.status]));
  expect(statuses).toEqual({
    invalid400: 400,
    notFound404: 404,
    rateLimited429: 429,
    upstreamTimeout504: 504,
    unavailable503: 503,
    serverError500: 500,
    badGatewayHtml502: 502,
    contractViolation200: 200
  });
  const codes = {
    invalid400: "INVALID_NUMBER",
    notFound404: "NOT_FOUND",
    rateLimited429: "RATE_LIMITED",
    upstreamTimeout504: "API_TIMEOUT",
    unavailable503: "API_TIMEOUT",
    serverError500: "SERVER_ERROR"
  } as const;
  for (const name of Object.keys(codes) as Array<keyof typeof codes>) {
    const reply = FAILURE_RESPONSES[name];
    expect(reply.contentType, name).toBe("application/json");
    const parsed = ApiTrackResponseSchema.parse(JSON.parse(reply.body));
    expect(parsed.success, name).toBe(false);
    if (!parsed.success) expect(parsed.error.code, name).toBe(codes[name]);
  }
  expect(FAILURE_RESPONSES.badGatewayHtml502.contentType).toContain("text/html");
  expect(() => JSON.parse(FAILURE_RESPONSES.badGatewayHtml502.body)).toThrow();
  expect(ApiTrackResponseSchema.safeParse(JSON.parse(FAILURE_RESPONSES.contractViolation200.body)).success).toBe(false);
  expect(ApiTrackResponseSchema.parse(JSON.parse(successBody(trackData("delivered")))).success).toBe(true);
});

test("mockTrack fulfils POST /api/track after the delay, reports the body and lets other methods through", async () => {
  const handlers: Array<(route: Route) => Promise<void>> = [];
  const fakePage = {
    route: async (_url: string, handler: (route: Route) => Promise<void>) => {
      handlers.push(handler);
    }
  } as unknown as Page;
  const seen: unknown[] = [];
  await mockTrack(fakePage, "notFound404", { delayMs: 30, onRequest: (body) => seen.push(body) });
  expect(handlers).toHaveLength(1);

  const fulfilled: unknown[] = [];
  const postRoute = {
    request: () => ({ method: () => "POST", postDataJSON: () => ({ trackingNumber: FAKE.domestic, carrierCode: "AUTO" }) }),
    fulfill: async (reply: unknown) => {
      fulfilled.push(reply);
    },
    fallback: async () => {
      throw new Error("a POST must not fall back");
    }
  } as unknown as Route;
  const started = Date.now();
  await handlers[0]?.(postRoute);
  expect(Date.now() - started).toBeGreaterThanOrEqual(25);
  expect(seen).toEqual([{ trackingNumber: FAKE.domestic, carrierCode: "AUTO" }]);
  expect(fulfilled).toEqual([FAILURE_RESPONSES.notFound404]);

  let fellBack = false;
  const getRoute = {
    request: () => ({ method: () => "GET" }),
    fulfill: async () => {
      throw new Error("a GET must not be fulfilled");
    },
    fallback: async () => {
      fellBack = true;
    }
  } as unknown as Route;
  await handlers[0]?.(getRoute);
  expect(fellBack).toBe(true);
});
