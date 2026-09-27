import type { FailureCause, LookupOutcome, LookupRequest } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

// Pure (contract §11.1 rule 5): every time value arrives in an event (`at`, performance.now() in useLookup), never from a clock here.

type SuccessOutcome = Extract<LookupOutcome, { kind: "success" }>;
type FailureOutcome = Extract<LookupOutcome, { kind: "failure" }>;

export type LookupState =
  | { readonly phase: "idle"; readonly lastRequest: LookupRequest | null; readonly failureStreak: number }
  | { readonly phase: "loading"; readonly request: LookupRequest; readonly startedAt: number; readonly failureStreak: number }
  | { readonly phase: "settled"; readonly outcome: SuccessOutcome; readonly settledAt: number }
  | { readonly phase: "error"; readonly outcome: FailureOutcome; readonly settledAt: number };

export type LookupEvent =
  | { readonly type: "submit"; readonly request: LookupRequest; readonly at: number }
  | { readonly type: "succeeded"; readonly data: TrackResponseData; readonly at: number }
  | { readonly type: "failed"; readonly cause: FailureCause; readonly at: number }
  | { readonly type: "cancelled" }
  | { readonly type: "reset" };

export const INITIAL_LOOKUP_STATE: LookupState = { phase: "idle", lastRequest: null, failureStreak: 0 };

/** The request [다시 조회] repeats; null before the first lookup (S04 addition 1). */
export function lastRequestOf(state: LookupState): LookupRequest | null {
  switch (state.phase) {
    case "idle":
      return state.lastRequest;
    case "loading":
      return state.request;
    case "settled":
    case "error":
      return state.outcome.request;
  }
}

/** Failures in a row for `number`: the streak survives retries and cancels of the same number only (spec §5 "2회 연속 실패"). */
function streakFor(state: LookupState, number: string): number {
  switch (state.phase) {
    case "idle":
      return state.lastRequest?.number === number ? state.failureStreak : 0;
    case "loading":
      return state.request.number === number ? state.failureStreak : 0;
    case "settled":
      return 0;
    case "error":
      return state.outcome.request.number === number ? state.outcome.consecutiveFailures : 0;
  }
}

export function lookupReducer(state: LookupState, event: LookupEvent): LookupState {
  switch (event.type) {
    case "submit":
      return {
        phase: "loading",
        request: event.request,
        startedAt: event.at,
        failureStreak: streakFor(state, event.request.number)
      };
    case "succeeded":
      if (state.phase !== "loading") return state; // a late answer after a cancel or a newer submit changes nothing
      return { phase: "settled", outcome: { kind: "success", request: state.request, data: event.data }, settledAt: event.at };
    case "failed":
      if (state.phase !== "loading") return state;
      return {
        phase: "error",
        outcome: { kind: "failure", request: state.request, cause: event.cause, consecutiveFailures: state.failureStreak + 1 },
        settledAt: event.at
      };
    case "cancelled":
      if (state.phase !== "loading") return state;
      return { phase: "idle", lastRequest: state.request, failureStreak: state.failureStreak };
    case "reset":
      return INITIAL_LOOKUP_STATE;
  }
}
