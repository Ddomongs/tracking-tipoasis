import { expect, test } from "@playwright/test";
import { normalizeTrackingData } from "@/lib/services/normalizer";

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
    trackingNumber: "305912548213",
    type: "DOMESTIC",
    customsEvents: [waitingEvent],
    deliveryLookup: emptyDelivery,
    now: new Date("2026-07-20T12:00:00+09:00")
  });

  expect(data.currentStatus).toBe("통관목록접수");
  expect(data.currentStatusCode).toBe(2);
  expect(data.estimatedCustomsClearanceDate).toBe("2026-07-20T00:00:00+09:00");
  expect(data.estimatedDeliveryDate).toBe("2026-07-22T15:00:00.000Z");
  expect(data.customs.estimateAdjusted).toBe(true);
});

test("a future customs estimate keeps the original calculation", () => {
  const data = normalizeTrackingData({
    trackingNumber: "305912548213",
    type: "DOMESTIC",
    customsEvents: [waitingEvent],
    deliveryLookup: emptyDelivery,
    now: new Date("2026-07-16T12:00:00+09:00")
  });

  expect(data.estimatedCustomsClearanceDate).toBe("2026-07-17T01:31:53.000Z");
  expect(data.customs.estimateAdjusted).toBeUndefined();
});

test("actual customs completion is never replaced by an adjusted estimate", () => {
  const data = normalizeTrackingData({
    trackingNumber: "305912495223",
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
    trackingNumber: "509493884901",
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
    trackingNumber: "305912548213",
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
    trackingNumber: "305912548213",
    type: "DOMESTIC",
    customsEvents: [waitingEvent],
    deliveryLookup: emptyDelivery,
    now: new Date("2026-07-20T12:00:00+09:00")
  });

  expect(data.estimateStale).toBeUndefined();
});
