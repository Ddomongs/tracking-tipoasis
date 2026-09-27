import { expect, test } from "@playwright/test";
import { settleView } from "@/components/result/ResultSlot";
import { siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import { FIXTURE_NOW, trackData } from "../fixtures/tracking-fixtures";

const data = trackData("inTransit");
const outcome: LookupOutcome = { kind: "success", request: { number: data.trackingNumber, carrier: "AUTO", entry: "deepLink" }, data };
const derive = (value: LookupOutcome, now: Date): TrackingViewModel => deriveTrackingView(value, now, siteConfig);

// S07 review: a throwing derive must end in the 톡톡 fallback like a chunk that cannot load, never in an endless placeholder.
test("settleView returns the module and the view when both work", async () => {
  const resultModule = { deriveResultView: derive };
  const settled = await settleView(() => Promise.resolve(resultModule), outcome, FIXTURE_NOW);
  expect(settled?.module).toBe(resultModule);
  expect(settled?.view.guideKey).toBe("inTransit");
});

test("settleView reports a chunk that cannot load as failed", async () => {
  expect(await settleView(() => Promise.reject(new Error("ChunkLoadError")), outcome, FIXTURE_NOW)).toBeNull();
});

test("settleView reports a derive that throws as failed", async () => {
  const resultModule = {
    deriveResultView: (): TrackingViewModel => {
      throw new Error("없는 날짜입니다");
    }
  };
  expect(await settleView(() => Promise.resolve(resultModule), outcome, FIXTURE_NOW)).toBeNull();
});
