import { expect, test } from "@playwright/test";
import { INITIAL_LOOKUP_STATE, lastRequestOf, lookupReducer } from "@/lib/tracking/lookup-state";
import type { LookupEvent, LookupState } from "@/lib/tracking/lookup-state";
import type { LookupRequest } from "@/lib/tracking/types";
import { FAKE, trackData } from "../fixtures/tracking-fixtures";

const DOMESTIC: LookupRequest = { number: FAKE.domestic, carrier: "AUTO", entry: "manual" };
const DOMESTIC_RETRY: LookupRequest = { ...DOMESTIC, entry: "retry" };
const HBL: LookupRequest = { number: FAKE.hbl, carrier: "CJ", entry: "manual" };

const submit = (request: LookupRequest, at: number): LookupEvent => ({ type: "submit", request, at });
const fail = (at: number): LookupEvent => ({ type: "failed", cause: "upstreamTimeout", at });
const run = (events: readonly LookupEvent[], from: LookupState = INITIAL_LOOKUP_STATE): LookupState =>
  events.reduce((state, event) => lookupReducer(state, event), from);
const streakOf = (state: LookupState): number => (state.phase === "error" ? state.outcome.consecutiveFailures : -1);

test("starts idle with no request and no failures", () => {
  expect(INITIAL_LOOKUP_STATE).toEqual({ phase: "idle", lastRequest: null, failureStreak: 0 });
  expect(lastRequestOf(INITIAL_LOOKUP_STATE)).toBeNull();
});

test("submit starts loading at the event time", () => {
  expect(run([submit(DOMESTIC, 100)])).toEqual({ phase: "loading", request: DOMESTIC, startedAt: 100, failureStreak: 0 });
});

test("an answer settles the request that was loading", () => {
  const data = trackData("inTransit");
  expect(run([submit(DOMESTIC, 100), { type: "succeeded", data, at: 900 }])).toEqual({
    phase: "settled",
    outcome: { kind: "success", request: DOMESTIC, data },
    settledAt: 900
  });
});

test("failures for the same number count up across retries", () => {
  expect(run([submit(DOMESTIC, 0), fail(10), submit(DOMESTIC_RETRY, 20), fail(30)])).toEqual({
    phase: "error",
    outcome: { kind: "failure", request: DOMESTIC_RETRY, cause: "upstreamTimeout", consecutiveFailures: 2 },
    settledAt: 30
  });
});

test("a different number starts a new streak at 1", () => {
  expect(streakOf(run([submit(DOMESTIC, 0), fail(10), submit(HBL, 20), fail(30)]))).toBe(1);
});

test("a success resets the streak", () => {
  const events: LookupEvent[] = [
    submit(DOMESTIC, 0),
    fail(10),
    submit(DOMESTIC_RETRY, 20),
    { type: "succeeded", data: trackData("pending"), at: 30 },
    submit(DOMESTIC_RETRY, 40),
    fail(50)
  ];
  expect(streakOf(run(events))).toBe(1);
});

test("cancel returns to idle and keeps the request and the streak", () => {
  const cancelled = run([submit(DOMESTIC, 0), fail(10), submit(DOMESTIC_RETRY, 20), { type: "cancelled" }]);
  expect(cancelled).toEqual({ phase: "idle", lastRequest: DOMESTIC_RETRY, failureStreak: 1 });
  expect(streakOf(run([submit(DOMESTIC_RETRY, 30), fail(40)], cancelled))).toBe(2);
});

test("late answers after cancel or settle change nothing", () => {
  const settled = run([submit(DOMESTIC, 0), { type: "succeeded", data: trackData("delivered"), at: 10 }]);
  const failed = run([submit(DOMESTIC, 0), fail(10)]);
  const cancelled = run([submit(DOMESTIC, 0), { type: "cancelled" }]);
  for (const state of [INITIAL_LOOKUP_STATE, settled, failed, cancelled]) {
    expect(lookupReducer(state, { type: "succeeded", data: trackData("pending"), at: 99 })).toBe(state);
    expect(lookupReducer(state, fail(99))).toBe(state);
    expect(lookupReducer(state, { type: "cancelled" })).toBe(state);
  }
});

test("reset forgets everything", () => {
  expect(run([submit(DOMESTIC, 0), fail(10), { type: "reset" }])).toBe(INITIAL_LOOKUP_STATE);
});

test("the last request is the one [다시 조회] repeats, in every phase", () => {
  expect(lastRequestOf(run([submit(DOMESTIC, 0)]))).toEqual(DOMESTIC);
  expect(lastRequestOf(run([submit(DOMESTIC, 0), fail(1)]))).toEqual(DOMESTIC);
  expect(lastRequestOf(run([submit(HBL, 0), { type: "succeeded", data: trackData("inTransit"), at: 1 }]))).toEqual(HBL);
  expect(lastRequestOf(run([submit(HBL, 0), { type: "cancelled" }]))).toEqual(HBL);
});

test("the reducer never mutates the state it receives", () => {
  const loading = Object.freeze(run([submit(DOMESTIC, 0)]));
  const snapshot = JSON.stringify(loading);
  lookupReducer(loading, fail(5));
  lookupReducer(loading, { type: "cancelled" });
  expect(JSON.stringify(loading)).toBe(snapshot);
});
