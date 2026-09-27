import { expect, test } from "@playwright/test";
import { lookup, notices } from "@/config/site.config";
import {
  computeDisplay,
  outcomeKey,
  viewModeOf,
  type DerivedView,
  type DisplayInput
} from "@/components/lookup/lookup-display";
import type { LoadingConfig } from "@/lib/config/types";
import { deriveLoadingView } from "@/lib/tracking/loading-view";
import { INITIAL_LOOKUP_STATE, type LookupState } from "@/lib/tracking/lookup-state";
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
const BASE: DisplayInput = { state: INITIAL_LOOKUP_STATE, loading: null, entry: HOME, formOpen: true, localInvalid: null, derived: null };

test("idle: the home shows the form, an unopened deep link shows the pending card", () => {
  expect(computeDisplay(BASE)).toEqual({ kind: "form", busy: false, invalid: null });
  expect(computeDisplay({ ...BASE, entry: DEEP, formOpen: false })).toEqual({ kind: "pending", request: DEEP_REQUEST });
  expect(computeDisplay({ ...BASE, entry: DEEP, formOpen: true })).toEqual({ kind: "form", busy: false, invalid: null });
});

test("a manual lookup keeps the busy form for the first 0.4 s, then the status slot takes over", () => {
  const state = loadingState(MANUAL);
  expect(computeDisplay({ ...BASE, state, loading: loadingAt(MANUAL, 0) })).toEqual({ kind: "form", busy: true, invalid: null });
  expect(computeDisplay({ ...BASE, state, loading: loadingAt(MANUAL, 500) })).toEqual({ kind: "slot", request: MANUAL, derived: null });
  expect(computeDisplay({ ...BASE, state, loading: loadingAt(MANUAL, 9000) })).toEqual({ kind: "slot", request: MANUAL, derived: null });
});

test("deep links, restores, retries and carrier chips show the pending card instead of the busy form", () => {
  for (const entry of ["deepLink", "restore", "retry", "carrierChip", "autoRetryOnline"] as const) {
    const request: LookupRequest = { ...MANUAL, entry };
    expect(
      computeDisplay({ ...BASE, entry: DEEP, formOpen: false, state: loadingState(request), loading: loadingAt(request, 0) }),
      entry
    ).toEqual({ kind: "pending", request });
  }
});

test("a settled or failed lookup shows its result only once its own view is derived", () => {
  const settled: LookupState = { phase: "settled", outcome: SUCCESS, settledAt: 2 };
  const own: DerivedView = { key: outcomeKey(SUCCESS), seq: 1, view: null };
  const stale: DerivedView = { key: outcomeKey({ ...SUCCESS, request: { ...MANUAL, number: FAKE.domesticAlt } }), seq: 1, view: null };
  expect(computeDisplay({ ...BASE, state: settled, derived: own })).toEqual({ kind: "slot", request: MANUAL, derived: own });
  expect(computeDisplay({ ...BASE, state: settled, derived: stale })).toEqual({ kind: "pending", request: MANUAL });
  expect(computeDisplay({ ...BASE, state: settled })).toEqual({ kind: "pending", request: MANUAL });
  const failed = failure("notFound");
  const error: LookupState = { phase: "error", outcome: failed, settledAt: 3 };
  const ownFailure: DerivedView = { key: outcomeKey(failed), seq: 2, view: null };
  expect(outcomeKey(failed)).not.toBe(outcomeKey(failure("serverError")));
  expect(computeDisplay({ ...BASE, state: error, derived: ownFailure })).toEqual({ kind: "slot", request: MANUAL, derived: ownFailure });
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
  expect(viewModeOf({ kind: "pending", request: DEEP_REQUEST }, "idle")).toBe("loading");
  expect(viewModeOf({ kind: "pending", request: MANUAL }, "settled")).toBe("loading");
  expect(viewModeOf({ kind: "slot", request: MANUAL, derived: null }, "loading")).toBe("loading");
  expect(viewModeOf({ kind: "slot", request: MANUAL, derived: null }, "settled")).toBe("settled");
  expect(viewModeOf({ kind: "slot", request: MANUAL, derived: null }, "error")).toBe("error");
});
