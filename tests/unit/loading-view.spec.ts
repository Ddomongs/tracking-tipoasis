import { expect, test } from "@playwright/test";
import type { LoadingConfig } from "@/lib/config/types";
import { carrierOfficialUrl } from "@/lib/tracking/carriers";
import { deriveLoadingView, loadingStageAt, nextLoadingChangeMs } from "@/lib/tracking/loading-view";
import type { LoadingViewModel, LookupRequest } from "@/lib/tracking/types";
import { FIXTURE_CONFIG, withConfig } from "../fixtures/config-fixtures";
import { FAKE, FAKE_GROUPED, FIXTURE_NOW } from "../fixtures/tracking-fixtures";

// Timings pinned here so S10 Part B can change the shipped values without editing this file.
const LOADING: LoadingConfig = {
  lookup: { ...FIXTURE_CONFIG.lookup, skeletonDelayMs: 400, stageMs: [3000, 8000], spinnerStopMs: 5000, elapsedStepSeconds: 5, timeoutMs: 45000 },
  notices: FIXTURE_CONFIG.notices
};
const AUTO: LookupRequest = { number: FAKE.domestic, carrier: "AUTO", entry: "manual" };
const CJ: LookupRequest = { number: FAKE.domestic, carrier: "CJ", entry: "deepLink" };

function view(elapsedMs: number, request: LookupRequest = AUTO, reducedMotion = false, now: Date = FIXTURE_NOW): LoadingViewModel {
  return deriveLoadingView({ request, elapsedMs, reducedMotion, now }, LOADING);
}

test("stage bounds: [0, 0.4 s) instant, [0.4, 3 s) short, [3, 8 s) long, from 8 s very long", () => {
  expect([0, 399, 400, 2999, 3000, 7999, 8000, 44999].map((ms) => loadingStageAt(ms, LOADING)))
    .toEqual(["instant", "instant", "short", "short", "long", "long", "veryLong", "veryLong"]);
});

test("0–0.4 s: only the busy label changes", () => {
  const model = view(100);
  expect(model.stage).toBe("instant");
  expect(model.submitLabel).toBe("조회 중…");
  expect(model.title).toBe("조회하고 있어요");
  expect(model.body).toBe("관세청 통관 정보와 택배사 배송 정보를 함께 확인해요");
  expect(model.number).toEqual({ raw: FAKE.domestic, grouped: FAKE_GROUPED.domestic });
  expect(model.carrier).toEqual({ code: "AUTO", name: null, barLabel: "택배사 자동 확인", officialUrl: null });
  expect([model.extra, model.elapsedText, model.cancel, model.carrierOfficial, model.announcement]).toEqual([null, null, null, null, null]);
});

test("0.4–3 s: the card appears and '조회를 시작했어요' is the announcement", () => {
  const model = view(400);
  expect(model.stage).toBe("short");
  expect(model.announcement).toBe("조회를 시작했어요");
  expect(model.extra).toBeNull();
  expect(model.cancel).toBeNull();
});

test("3 s: the long-wait sentence and [조회 취소]; no cause is claimed", () => {
  const model = view(3000);
  expect(model.extra).toBe("해외 화물은 여러 해의 기록을 찾아서 조금 더 걸려요. 보통 10초 안에 끝나요.");
  expect(model.extra).not.toContain("번호 문제는 아니에요");
  expect(model.cancel).toEqual({ kind: "cancel", label: "조회 취소", weight: "secondary", href: null, external: false, cooldownSeconds: null });
  expect(model.announcement).toBeNull();
});

test("8 s: the very-long sentence is announced; the elapsed text steps every 5 s", () => {
  const model = view(8000);
  expect(model.extra).toBe("기록이 없는 번호는 15초 가까이 걸릴 수 있어요. 번호가 맞는지 한 번 봐 주세요.");
  expect(model.announcement).toBe(model.extra);
  expect(model.carrierOfficial).toBeNull();
  expect([8000, 12999, 13000, 30500].map((ms) => view(ms).elapsedText)).toEqual(["8초째", "8초째", "13초째", "28초째"]);
});

test("8 s with a chosen carrier: '택배사 공식 조회로 먼저 보기' opens the carrier's page", () => {
  expect(view(7999, CJ).carrierOfficial).toBeNull();
  expect(view(8000, CJ).carrierOfficial).toEqual({
    kind: "carrierOfficial", label: "택배사 공식 조회로 먼저 보기", weight: "text",
    href: carrierOfficialUrl("CJ", FAKE.domestic), external: true, cooldownSeconds: null
  });
  expect(view(100, CJ).carrier.barLabel).toBe("CJ대한통운");
});

test("the spinner stops at 5 s and never spins with reduced motion", () => {
  expect(view(4999).spinnerActive).toBe(true);
  expect(view(5000).spinnerActive).toBe(false);
  expect(view(100, AUTO, true).spinnerActive).toBe(false);
});

test("only outage notices show while loading", () => {
  expect(view(400, AUTO, false, new Date("2026-09-26T22:30:00+09:00")).outageNotice?.id).toBe("fx-outage");
  expect(view(400).outageNotice).toBeNull();
  const holidayForLoading: LoadingConfig = { lookup: LOADING.lookup, notices: [{ ...FIXTURE_CONFIG.notices[0], guideKeys: ["loading"] }] };
  expect(deriveLoadingView({ request: AUTO, elapsedMs: 400, reducedMotion: false, now: FIXTURE_NOW }, holidayForLoading).outageNotice).toBeNull();
});

test("next change times give one timer per visible change", () => {
  expect([0, 400, 3000, 5000, 8000, 12999, 13000].map((ms) => nextLoadingChangeMs(ms, LOADING)))
    .toEqual([400, 3000, 5000, 8000, 13000, 13000, 18000]);
});

test("the R4 timings from S10 Part B work the same way", () => {
  const r4 = withConfig({ lookup: { stageMs: [3000, 7000], timeoutMs: 25000, elapsedStepSeconds: 5 } });
  expect(loadingStageAt(7000, r4)).toBe("veryLong");
  expect(deriveLoadingView({ request: AUTO, elapsedMs: 12000, reducedMotion: false, now: FIXTURE_NOW }, r4).elapsedText).toBe("12초째");
});
