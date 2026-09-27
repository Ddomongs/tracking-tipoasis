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
