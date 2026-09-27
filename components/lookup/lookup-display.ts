/**
 * What the lookup island shows (spec §3 "화면 모드는 컴포넌트 상태", §5 시간축). Pure: the island passes its state in and
 * renders the display it gets back. Modes never live in the URL (GAP1-10).
 */
import type { LookupState } from "@/lib/tracking/lookup-state";
import type {
  LoadingViewModel,
  LookupOutcome,
  LookupRequest,
  NoticeView,
  TrackingEntry,
  TrackingViewModel,
  ViewMode
} from "@/lib/tracking/types";
import type { Notice } from "@/lib/config/types";
import { activeNotices } from "@/lib/tracking/notices";

/** The error under the input: from the client pre-check, or a server INVALID answer (diagnosis null). */
export interface InvalidInput {
  readonly diagnosis: string | null;
  /** Grows with every failed attempt so the role=alert sentence is announced again. */
  readonly attempt: number;
}

/** The view model derived for one settled outcome; `view` is null when the result code could not be loaded. */
export interface DerivedView {
  readonly key: string;
  readonly seq: number;
  readonly view: TrackingViewModel | null;
}

export type LookupDisplay =
  | { readonly kind: "form"; readonly busy: boolean; readonly invalid: InvalidInput | null }
  | { readonly kind: "pending"; readonly request: LookupRequest }
  | { readonly kind: "slot"; readonly request: LookupRequest; readonly derived: DerivedView | null };

export interface DisplayInput {
  readonly state: LookupState;
  readonly loading: LoadingViewModel | null;
  readonly entry: TrackingEntry;
  /** False only for a deep link whose form the customer has not opened. */
  readonly formOpen: boolean;
  readonly localInvalid: InvalidInput | null;
  readonly derived: DerivedView | null;
}

/** Identifies one settled outcome: result kind, request and failure cause. */
export function outcomeKey(outcome: LookupOutcome): string {
  const { number, carrier, entry } = outcome.request;
  const cause = outcome.kind === "failure" ? outcome.cause : "";
  return [outcome.kind, number, carrier, entry, cause].join("|");
}

function settledDisplay(outcome: LookupOutcome, derived: DerivedView | null): LookupDisplay {
  if (derived === null || derived.key !== outcomeKey(outcome)) return { kind: "pending", request: outcome.request };
  return { kind: "slot", request: outcome.request, derived };
}

/**
 * form    — idle, the INVALID screen, and a manual lookup's first 0.4 s (only the button label changes, spec §5);
 * pending — the static '조회하고 있어요' card: a deep link before its lookup starts, any non-manual lookup's first 0.4 s,
 *           and a settled lookup whose view is still being derived;
 * slot    — S04's status slot (loading from 0.4 s, errors, results).
 */
export function computeDisplay(input: DisplayInput): LookupDisplay {
  const { state, loading, entry, formOpen, localInvalid, derived } = input;
  if (localInvalid !== null) return { kind: "form", busy: false, invalid: localInvalid };
  switch (state.phase) {
    case "idle":
      if (!formOpen && entry.kind === "deepLink") {
        return { kind: "pending", request: { number: entry.number, carrier: entry.carrier, entry: "deepLink" } };
      }
      return { kind: "form", busy: false, invalid: null };
    case "loading":
      if ((loading?.stage ?? "instant") !== "instant") return { kind: "slot", request: state.request, derived: null };
      return state.request.entry === "manual"
        ? { kind: "form", busy: true, invalid: null }
        : { kind: "pending", request: state.request };
    case "error":
      if (state.outcome.cause === "invalidNumber") return { kind: "form", busy: false, invalid: { diagnosis: null, attempt: 0 } };
      return settledDisplay(state.outcome, derived);
    case "settled":
      return settledDisplay(state.outcome, derived);
  }
}

export function viewModeOf(display: LookupDisplay, phase: LookupState["phase"]): ViewMode {
  if (display.kind === "form") {
    if (display.invalid !== null) return "error";
    return display.busy ? "loading" : "idle";
  }
  if (display.kind === "pending") return "loading";
  if (phase === "settled") return "settled";
  return phase === "error" ? "error" : "loading";
}

/**
 * '/' is static and cached for up to 5 minutes, so the server-picked home notice may already have ended by the time the
 * customer sees it. After mount it survives only while it is still active at the customer's clock (spec §9 "'/'는
 * 마운트 뒤 KST로 다시 걸러"). `nowMs` is null while hydrating: the server pick is kept so the HTML matches.
 */
export function stillActiveHomeNotice(notice: NoticeView | null, all: readonly Notice[], nowMs: number | null): NoticeView | null {
  if (notice === null || nowMs === null) return notice;
  return activeNotices(all, new Date(nowMs), { kind: "home" }).some((item) => item.id === notice.id) ? notice : null;
}
