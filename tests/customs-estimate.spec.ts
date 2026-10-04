import { expect, test } from "@playwright/test";
import { normalizeTrackingData } from "@/lib/services/normalizer";
import { FAKE } from "./fixtures/tracking-fixtures";

const waitingEvent = {
  status: "통관목록접수",
  statusCode: 2 as const,
  datetime: "2026-07-16T10:31:53+09:00"
};

const emptyDelivery = {
  carrier: "국내택배 자동 조회",
  carrierCode: "AUTO" as const,
  events: []
};

test("a stale customs estimate is recalculated from today while customs is still waiting", () => {
  const data = normalizeTrackingData({
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    customsEvents: [waitingEvent],
    deliveryLookup: emptyDelivery,
    now: new Date("2026-07-21T12:00:00+09:00")
  });

  expect(data.currentStatus).toBe("통관목록접수");
  expect(data.currentStatusCode).toBe(2);
  expect(data.estimatedCustomsClearanceDate).toBe("2026-07-21T00:00:00+09:00");
  expect(data.estimatedDeliveryDate).toBe("2026-07-23T15:00:00.000Z");
  expect(data.customs.estimateAdjusted).toBe(true);
});

test("a future customs estimate keeps the original calculation", () => {
  const data = normalizeTrackingData({
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    customsEvents: [waitingEvent],
    deliveryLookup: emptyDelivery,
    now: new Date("2026-07-16T12:00:00+09:00")
  });

  // One customs working day after Thu 7/16 skips 제헌절 (Fri 7/17) and the weekend (10월 4일 요청).
  expect(data.estimatedCustomsClearanceDate).toBe("2026-07-20T01:31:53.000Z");
  expect(data.customs.estimateAdjusted).toBeUndefined();
});

test("actual customs completion is never replaced by an adjusted estimate", () => {
  const data = normalizeTrackingData({
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    customsEvents: [
      waitingEvent,
      {
        status: "통관완료",
        statusCode: 4,
        datetime: "2026-07-18T09:20:00+09:00"
      }
    ],
    deliveryLookup: emptyDelivery,
    now: new Date("2026-07-20T12:00:00+09:00")
  });

  expect(data.currentStatusCode).toBe(4);
  expect(data.estimatedCustomsClearanceDate).toBe("2026-07-18T09:20:00+09:00");
  expect(data.customs.estimateAdjusted).toBeUndefined();
});

test("a shipment with no activity for weeks stops showing a delivery estimate", () => {
  const data = normalizeTrackingData({
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    customsEvents: [
      { status: "통관목록접수", statusCode: 2, datetime: "2026-02-13T09:00:00+09:00" },
      { status: "통관완료", statusCode: 4, datetime: "2026-02-13T12:00:00+09:00" }
    ],
    deliveryLookup: emptyDelivery,
    now: new Date("2026-09-03T12:00:00+09:00")
  });

  expect(data.currentStatusCode).toBe(4);
  expect(data.estimateStale).toBe(true);
  expect(data.estimatedDeliveryDate).toBeUndefined();
  expect(data.estimatedCustomsClearanceDate).toBe("2026-02-13T12:00:00+09:00");
});

test("a shipment still waiting for customs after weeks is marked stale instead of recalculated", () => {
  const data = normalizeTrackingData({
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    customsEvents: [waitingEvent],
    deliveryLookup: emptyDelivery,
    now: new Date("2026-09-03T12:00:00+09:00")
  });

  expect(data.estimateStale).toBe(true);
  expect(data.estimatedDeliveryDate).toBeUndefined();
  expect(data.estimatedCustomsClearanceDate).toBeUndefined();
  expect(data.customs.estimateAdjusted).toBeUndefined();
});

test("a recent shipment is not marked stale", () => {
  const data = normalizeTrackingData({
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    customsEvents: [waitingEvent],
    deliveryLookup: emptyDelivery,
    now: new Date("2026-07-20T12:00:00+09:00")
  });

  expect(data.estimateStale).toBeUndefined();
});

test.describe("arrival estimate days (10월 4일 요청)", () => {
  const cleared = (datetime: string) => ({ status: "통관완료", statusCode: 4 as const, datetime });
  const carrier = (carrierCode: "CJ" | "HANJIN") => ({ carrier: carrierCode, carrierCode, events: [] });

  test("CJ counts Saturday and Sunday; other carriers skip Sunday", () => {
    // Cleared Fri 10/16: three delivery days.
    const now = new Date("2026-10-16T12:00:00+09:00");
    const cj = normalizeTrackingData({ trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: [cleared("2026-10-16T09:00:00+09:00")], deliveryLookup: carrier("CJ"), now });
    const hanjin = normalizeTrackingData({ trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: [cleared("2026-10-16T09:00:00+09:00")], deliveryLookup: carrier("HANJIN"), now });
    expect(cj.estimatedDeliveryDate).toBe("2026-10-19T00:00:00.000Z"); // Sat, Sun, Mon
    expect(hanjin.estimatedDeliveryDate).toBe("2026-10-20T00:00:00.000Z"); // Sat, Mon, Tue
  });

  test("CJ rests on 추석 but delivers on other holidays", () => {
    const now = new Date("2026-10-08T12:00:00+09:00");
    // Cleared Thu 10/8: 한글날 Fri 10/9 counts for CJ only.
    const cj = normalizeTrackingData({ trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: [cleared("2026-10-08T09:00:00+09:00")], deliveryLookup: carrier("CJ"), now });
    expect(cj.estimatedDeliveryDate).toBe("2026-10-11T00:00:00.000Z"); // 10/9, 10/10, 10/11
    const chuseok = normalizeTrackingData({
      trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: [cleared("2026-09-23T09:00:00+09:00")], deliveryLookup: carrier("CJ"),
      now: new Date("2026-09-23T12:00:00+09:00")
    });
    expect(chuseok.estimatedDeliveryDate).toBe("2026-09-29T00:00:00.000Z"); // 추석 9/24–26 off: 9/27, 9/28, 9/29
  });

  test("customs skips the weekend unless this shipment already moved on a day off", () => {
    const friday = { status: "통관목록접수", statusCode: 2 as const, datetime: "2026-10-16T10:00:00+09:00" };
    const now = new Date("2026-10-16T12:00:00+09:00");
    const weekdayOnly = normalizeTrackingData({ trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: [friday], deliveryLookup: emptyDelivery, now });
    expect(weekdayOnly.estimatedCustomsClearanceDate).toBe("2026-10-19T01:00:00.000Z"); // Mon
    const saturday = { status: "통관목록접수", statusCode: 2 as const, datetime: "2026-10-17T10:00:00+09:00" };
    const arrivedSaturday = normalizeTrackingData({
      trackingNumber: FAKE.domestic, type: "DOMESTIC", customsEvents: [{ ...saturday, status: "입항", statusCode: 1 as const, datetime: "2026-10-17T08:00:00+09:00" }, saturday],
      deliveryLookup: emptyDelivery, now: new Date("2026-10-17T12:00:00+09:00")
    });
    expect(arrivedSaturday.estimatedCustomsClearanceDate).toBe("2026-10-18T01:00:00.000Z"); // Sun: this area works weekends
  });
});
