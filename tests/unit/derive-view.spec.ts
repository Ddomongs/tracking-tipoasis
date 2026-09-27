import { expect, test } from "@playwright/test";
import { guideKeyForData, isOverdue, worryDateKey } from "@/lib/tracking/derive-view";
import type { GuideKey } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { FIXTURE_CONFIG } from "../fixtures/config-fixtures";
import {
  MOVED_NOW, OCTOBER_NOW, PICKUP_NOW, ambiguousData, carrierCutData, customsArrivedData, customsClearedData, customsReviewData,
  customsWaitingData, deliveredData, handedToCarrierData, inTransitData, lookupUnavailableData, movedEstimateData, pendingData,
  pickedUpData, staleData
} from "../fixtures/derive-scenarios";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const CONFIG = FIXTURE_CONFIG;
const at = (iso: string): Date => new Date(iso);

interface KeyRow { readonly name: string; readonly data: TrackResponseData; readonly now: Date; readonly key: GuideKey }

const cleared = customsClearedData();
const KEY_ROWS: readonly KeyRow[] = [
  { name: "ambiguous with 0 events", data: ambiguousData(), now: FIXTURE_NOW, key: "ambiguous" },
  { name: "carrier lookup delay with 0 events", data: lookupUnavailableData("AUTO"), now: FIXTURE_NOW, key: "lookupUnavailable" },
  { name: "pending (domestic, no record)", data: pendingData(), now: FIXTURE_NOW, key: "pending" },
  { name: "delivered", data: deliveredData(), now: FIXTURE_NOW, key: "delivered" },
  { name: "delivered wins over a stale flag", data: { ...deliveredData(), estimateStale: true }, now: FIXTURE_NOW, key: "delivered" },
  { name: "stale by the server flag", data: staleData(), now: FIXTURE_NOW, key: "stale" },
  { name: "stale when read 15 days after the last event", data: customsWaitingData(), now: at("2026-10-08T14:10:00+09:00"), key: "stale" },
  { name: "exactly 14 days is not stale yet", data: customsWaitingData(), now: at("2026-10-07T14:10:00+09:00"), key: "customsWaiting" },
  { name: "in transit (code 6)", data: inTransitData(), now: OCTOBER_NOW, key: "inTransit" },
  { name: "picked up (code 5, 집화)", data: pickedUpData(), now: PICKUP_NOW, key: "pickedUp" },
  { name: "handed to carrier (code 5, not a pickup)", data: handedToCarrierData(), now: PICKUP_NOW, key: "handedToCarrier" },
  { name: "customs cleared (code 4)", data: cleared, now: FIXTURE_NOW, key: "customsCleared" },
  { name: "carrier delay with customs events stays code-based", data: carrierCutData(), now: FIXTURE_NOW, key: "customsCleared" },
  { name: "several carriers with customs events stays code-based", data: { ...cleared, delivery: { ...cleared.delivery, ambiguous: true } }, now: FIXTURE_NOW, key: "customsCleared" },
  { name: "customs waiting (code 2)", data: customsWaitingData(), now: FIXTURE_NOW, key: "customsWaiting" },
  { name: "customs review (code 3)", data: customsReviewData(), now: FIXTURE_NOW, key: "customsWaiting" },
  { name: "arrived (code 1)", data: customsArrivedData(), now: FIXTURE_NOW, key: "customsArrived" }
];

test.describe("guide keys from data (priority order)", () => {
  for (const row of KEY_ROWS) {
    test(row.name, () => {
      expect(guideKeyForData(row.data, row.now, CONFIG)).toBe(row.key);
    });
  }
});

test.describe("worry dates", () => {
  test("customs waiting: the moved estimate is capped by the last customs event + 2 days, then + 1 business day", () => {
    expect(worryDateKey(customsWaitingData(), "customsWaiting", CONFIG)).toBe("2026-09-28");
  });

  test("arrived: estimate 9/27 (Sun) + 1 business day", () => {
    expect(worryDateKey(customsArrivedData(), "customsArrived", CONFIG)).toBe("2026-09-28");
  });

  test("customs cleared: spec example 9/23 → 9/29 (추석 and the weekend skipped)", () => {
    expect(worryDateKey(customsClearedData(), "customsCleared", CONFIG)).toBe("2026-09-29");
  });

  test("picked up or handed over: 2 business days after the latest progress, skipping 한글날 and the weekend", () => {
    expect(worryDateKey(pickedUpData(), "pickedUp", CONFIG)).toBe("2026-10-13");
    expect(worryDateKey(handedToCarrierData(), "handedToCarrier", CONFIG)).toBe("2026-10-13");
  });

  test("in transit: delivery estimate + 1 delivery business day", () => {
    expect(worryDateKey(inTransitData(), "inTransit", CONFIG)).toBe("2026-10-15");
  });

  test("an estimate the server moved to today no longer moves the worry date", () => {
    expect(worryDateKey(movedEstimateData(), "customsWaiting", CONFIG)).toBe("2026-09-18");
    expect(isOverdue("2026-09-18", MOVED_NOW)).toBe(true);
  });

  test("states without a date-based worry line", () => {
    expect(worryDateKey(pendingData(), "pending", CONFIG)).toBeNull();
    expect(worryDateKey(deliveredData(), "delivered", CONFIG)).toBeNull();
    expect(worryDateKey(staleData(), "stale", CONFIG)).toBeNull();
    expect(worryDateKey(lookupUnavailableData("AUTO"), "lookupUnavailable", CONFIG)).toBeNull();
    expect(worryDateKey(ambiguousData(), "ambiguous", CONFIG)).toBeNull();
  });
});

function overdueBoundaryRows(): void {
  const worry = "2026-09-28";

  test("overdue: day before, day of, day after (KST)", () => {
    expect(isOverdue(worry, at("2026-09-27T12:00:00+09:00"))).toBe(false);
    expect(isOverdue(worry, at("2026-09-28T12:00:00+09:00"))).toBe(false);
    expect(isOverdue(worry, at("2026-09-29T09:00:00+09:00"))).toBe(true);
  });

  test("overdue flips exactly at KST midnight", () => {
    expect(isOverdue(worry, at("2026-09-28T23:59:59+09:00"))).toBe(false);
    expect(isOverdue(worry, at("2026-09-29T00:00:00+09:00"))).toBe(true);
    expect(isOverdue(worry, at("2026-09-28T15:00:00Z"))).toBe(true);
  });
}

test.describe("overdue", () => {
  overdueBoundaryRows();

  test("no worry date is never overdue", () => {
    expect(isOverdue(null, at("2030-01-01T00:00:00+09:00"))).toBe(false);
  });
});

test.describe("state keys and dates in America/New_York", () => {
  let previousTz: string | undefined;

  test.beforeAll(() => {
    previousTz = process.env.TZ;
    process.env.TZ = "America/New_York";
  });

  test.afterAll(() => {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });

  test("keys and worry dates do not depend on the device time zone", () => {
    expect(new Date("2026-09-26T00:00:00Z").getHours()).toBe(20);
    expect(guideKeyForData(customsWaitingData(), FIXTURE_NOW, CONFIG)).toBe("customsWaiting");
    expect(worryDateKey(customsWaitingData(), "customsWaiting", CONFIG)).toBe("2026-09-28");
    expect(worryDateKey(inTransitData(), "inTransit", CONFIG)).toBe("2026-10-15");
  });

  overdueBoundaryRows();
});
