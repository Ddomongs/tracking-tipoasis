import { expect, test } from "@playwright/test";
import { lookup, notices } from "@/config/site.config";
import { computeDisplay, stillActiveHomeNotice, viewModeOf, type DisplayInput } from "@/components/lookup/lookup-display";
import type { LoadingConfig, Notice } from "@/lib/config/types";
import { deriveLoadingView } from "@/lib/tracking/loading-view";
import { INITIAL_LOOKUP_STATE, type LookupState } from "@/lib/tracking/lookup-state";
import { toNoticeView } from "@/lib/tracking/notices";
import type { FailureCause, LoadingViewModel, LookupOutcome, LookupRequest, TrackingEntry } from "@/lib/tracking/types";
import { FAKE, FIXTURE_NOW, trackData } from "../fixtures/tracking-fixtures";

const LOADING_CONFIG: LoadingConfig = { lookup, notices };
const MANUAL: LookupRequest = { number: FAKE.domestic, carrier: "AUTO", entry: "manual" };
const DEEP_REQUEST: LookupRequest = { number: FAKE.hbl, carrier: "CJ", entry: "deepLink" };
const HOME: TrackingEntry = { kind: "home" };
const DEEP: TrackingEntry = { kind: "deepLink", number: FAKE.hbl, carrier: "CJ" };

const loadingAt = (request: LookupRequest, elapsedMs: number): LoadingViewModel =>
  deriveLoadingView({ request, elapsedMs, reducedMotion: false, now: FIXTURE_NOW }, LOADING_CONFIG);
const loadingState = (request: LookupRequest): LookupState => ({ phase: "loading", request, startedAt: 1, failureStreak: 0 });
const SUCCESS: Extract<LookupOutcome, { kind: "success" }> = {
  kind: "success",
  request: MANUAL,
  data: trackData("inTransit", { trackingNumber: FAKE.domestic })
};
const failure = (cause: FailureCause): Extract<LookupOutcome, { kind: "failure" }> => ({
  kind: "failure",
  request: MANUAL,
  cause,
  consecutiveFailures: 1
});
const BASE: DisplayInput = { state: INITIAL_LOOKUP_STATE, loading: null, entry: HOME, formOpen: true, localInvalid: null };

const HOME_NOTICE: Notice = {
  id: "test-home-notice",
  kind: "holiday",
  title: "연휴 배송 안내",
  body: "연휴에는 통관·택배가 쉬어요. 다음 영업일부터 순서대로 진행돼요.",
  startsAt: "2026-09-21T00:00:00+09:00",
  endsAt: "2026-09-29T00:00:00+09:00",
  home: true,
  guideKeys: [],
  cs: false
};

test("idle: the home shows the form, an unopened deep link shows the result area (its first-paint loading card)", () => {
  expect(computeDisplay(BASE)).toEqual({ kind: "form", busy: false, invalid: null });
  expect(computeDisplay({ ...BASE, entry: DEEP, formOpen: false })).toEqual({ kind: "result", request: DEEP_REQUEST });
  expect(computeDisplay({ ...BASE, entry: DEEP, formOpen: true })).toEqual({ kind: "form", busy: false, invalid: null });
});

test("a manual lookup keeps the busy form for the first 0.4 s, then the result area takes over", () => {
  const state = loadingState(MANUAL);
  expect(computeDisplay({ ...BASE, state, loading: loadingAt(MANUAL, 0) })).toEqual({ kind: "form", busy: true, invalid: null });
  expect(computeDisplay({ ...BASE, state, loading: loadingAt(MANUAL, 500) })).toEqual({ kind: "result", request: MANUAL });
  expect(computeDisplay({ ...BASE, state, loading: loadingAt(MANUAL, 9000) })).toEqual({ kind: "result", request: MANUAL });
});

test("deep links, restores, retries and carrier chips show the result area from the first moment", () => {
  for (const entry of ["deepLink", "restore", "retry", "carrierChip", "autoRetryOnline"] as const) {
    const request: LookupRequest = { ...MANUAL, entry };
    expect(
      computeDisplay({ ...BASE, entry: DEEP, formOpen: false, state: loadingState(request), loading: loadingAt(request, 0) }),
      entry
    ).toEqual({ kind: "result", request });
  }
});

test("a settled or failed lookup shows the result area at once; the result slot derives its view", () => {
  const settled: LookupState = { phase: "settled", outcome: SUCCESS, settledAt: 2 };
  expect(computeDisplay({ ...BASE, state: settled })).toEqual({ kind: "result", request: MANUAL });
  const error: LookupState = { phase: "error", outcome: failure("notFound"), settledAt: 3 };
  expect(computeDisplay({ ...BASE, state: error })).toEqual({ kind: "result", request: MANUAL });
});

test("a server INVALID answer and a failed pre-check both reopen the form with the error", () => {
  const error: LookupState = { phase: "error", outcome: failure("invalidNumber"), settledAt: 3 };
  expect(computeDisplay({ ...BASE, state: error })).toEqual({ kind: "form", busy: false, invalid: { diagnosis: null, attempt: 0 } });
  const local = { diagnosis: "지금 5자리예요", attempt: 2 };
  expect(computeDisplay({ ...BASE, state: loadingState(MANUAL), loading: loadingAt(MANUAL, 500), localInvalid: local })).toEqual({
    kind: "form",
    busy: false,
    invalid: local
  });
});

test("view modes follow the display", () => {
  expect(viewModeOf({ kind: "form", busy: false, invalid: null }, "idle")).toBe("idle");
  expect(viewModeOf({ kind: "form", busy: true, invalid: null }, "loading")).toBe("loading");
  expect(viewModeOf({ kind: "form", busy: false, invalid: { diagnosis: null, attempt: 0 } }, "error")).toBe("error");
  expect(viewModeOf({ kind: "result", request: DEEP_REQUEST }, "idle")).toBe("loading");
  expect(viewModeOf({ kind: "result", request: MANUAL }, "loading")).toBe("loading");
  expect(viewModeOf({ kind: "result", request: MANUAL }, "settled")).toBe("settled");
  expect(viewModeOf({ kind: "result", request: MANUAL }, "error")).toBe("error");
});

test("the home notice survives only while it is active on the customer's clock", () => {
  const view = toNoticeView(HOME_NOTICE);
  expect(stillActiveHomeNotice(view, [HOME_NOTICE], FIXTURE_NOW.getTime())).toEqual(view);
  expect(stillActiveHomeNotice(view, [HOME_NOTICE], Date.parse(HOME_NOTICE.endsAt))).toBeNull();
  expect(stillActiveHomeNotice(view, [], FIXTURE_NOW.getTime())).toBeNull();
  expect(stillActiveHomeNotice(view, [HOME_NOTICE], null)).toEqual(view);
  expect(stillActiveHomeNotice(null, [HOME_NOTICE], FIXTURE_NOW.getTime())).toBeNull();
});
