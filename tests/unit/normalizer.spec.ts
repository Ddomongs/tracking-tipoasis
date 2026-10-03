import { expect, test } from "@playwright/test";
import { normalizeTrackingData } from "@/lib/services/normalizer";
import { FAKE } from "../fixtures/tracking-fixtures";

test("normalizer calculates a clear customs completion estimate while customs is waiting", () => {
  const data = normalizeTrackingData({
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    customsEvents: [{ status: "통관목록접수", statusCode: 2, datetime: "2026-07-13T10:17:07+09:00" }],
    deliveryLookup: { carrier: "국내택배 자동 조회", carrierCode: "AUTO", events: [] },
    now: new Date("2026-07-13T12:00:00+09:00")
  });

  expect(data.currentStatusCode).toBe(2);
  expect(data.estimatedCustomsClearanceDate).toBe("2026-07-14T01:17:07.000Z");
  expect(data.estimatedDeliveryDate).toBe("2026-07-17T01:17:07.000Z");
});

test("estimates that already passed move to today and are marked adjusted", () => {
  const data = normalizeTrackingData({
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    customsEvents: [{ status: "통관목록접수", statusCode: 2, datetime: "2026-07-16T10:31:53+09:00" }],
    deliveryLookup: { carrier: "국내택배 자동 조회", carrierCode: "AUTO", events: [] },
    now: new Date("2026-07-20T12:00:00+09:00")
  });

  expect(data.estimatedCustomsClearanceDate).toBe("2026-07-20T00:00:00+09:00");
  expect(data.estimatedDeliveryDate).toBe("2026-07-22T15:00:00.000Z");
  expect(data.customs.estimateAdjusted).toBe(true);
});

test("the UNI-PASS item name becomes productName (tidied, at most 60 characters) and leaves the events (10월 2일 요청)", () => {
  const data = normalizeTrackingData({
    trackingNumber: FAKE.hbl,
    type: "HBL",
    customsEvents: [
      { status: "입항적재화물목록 제출", statusCode: 1, datetime: "2026-09-29T09:00:00+09:00" },
      { status: "반입신고", statusCode: 2, datetime: "2026-09-29T15:00:00+09:00", productName: "  WOMEN'S   RUNNING SHOES  " }
    ],
    deliveryLookup: { carrier: "국내택배 자동 조회", carrierCode: "AUTO", events: [] },
    now: new Date("2026-09-30T12:00:00+09:00")
  });
  expect(data.productName).toBe("WOMEN'S RUNNING SHOES");
  expect(data.customs.events.some((event) => "productName" in event)).toBe(false);

  const long = normalizeTrackingData({
    trackingNumber: FAKE.hbl,
    type: "HBL",
    customsEvents: [{ status: "반입신고", statusCode: 2, datetime: "2026-09-29T15:00:00+09:00", productName: "가".repeat(80) }],
    deliveryLookup: { carrier: "국내택배 자동 조회", carrierCode: "AUTO", events: [] },
    now: new Date("2026-09-30T12:00:00+09:00")
  });
  expect(long.productName).toBe(`${"가".repeat(59)}…`);

  const none = normalizeTrackingData({
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    customsEvents: [],
    deliveryLookup: { carrier: "국내택배 자동 조회", carrierCode: "AUTO", events: [] },
    now: new Date("2026-09-30T12:00:00+09:00")
  });
  expect(none.productName).toBeUndefined();
});
