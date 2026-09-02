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
