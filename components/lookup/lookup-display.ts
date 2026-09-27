/**
 * What the lookup island shows (spec §3 "화면 모드는 컴포넌트 상태", §5 시간축). Pure: the island passes its state in and
 * renders the display it gets back. Modes never live in the URL (GAP1-10). Since S07 the result area (loading card, result,
 * failure card) is one display: ResultSlot derives the view itself when the lookup settles.
 */
import type { Notice } from "@/lib/config/types";
import type { LookupState } from "@/lib/tracking/lookup-state";
import { activeNotices } from "@/lib/tracking/notices";
import type { LoadingViewModel, LookupRequest, NoticeView, TrackingEntry, ViewMode } from "@/lib/tracking/types";

/** The error under the input: from the client pre-check, or a server INVALID answer (diagnosis null). */
export interface InvalidInput {
  readonly diagnosis: string | null;
  /** Grows with every failed attempt so the role=alert sentence is announced again. */
  readonly attempt: number;
}

export type LookupDisplay =
  | { readonly kind: "form"; readonly busy: boolean; readonly invalid: InvalidInput | null }
  | { readonly kind: "result"; readonly request: LookupRequest };

export interface DisplayInput {
  readonly state: LookupState;
  readonly loading: LoadingViewModel | null;
  readonly entry: TrackingEntry;
  /** False only for a deep link whose form the customer has not opened. */
  readonly formOpen: boolean;
  readonly localInvalid: InvalidInput | null;
}

/**
 * form   — idle, the INVALID screen, and a manual lookup's first 0.4 s (only the button label changes, spec §5);
 * result — the number bar and the result area: a deep link before its lookup starts (first-paint loading card), any
 *          non-manual lookup from its first moment, a manual lookup from 0.4 s, and every settled or failed lookup.
 */
export function computeDisplay(input: DisplayInput): LookupDisplay {
  const { state, loading, entry, formOpen, localInvalid } = input;
  if (localInvalid !== null) return { kind: "form", busy: false, invalid: localInvalid };
  switch (state.phase) {
    case "idle":
      if (!formOpen && entry.kind === "deepLink") {
        return { kind: "result", request: { number: entry.number, carrier: entry.carrier, entry: "deepLink" } };
      }
      return { kind: "form", busy: false, invalid: null };
    case "loading":
      if ((loading?.stage ?? "instant") === "instant" && state.request.entry === "manual") {
        return { kind: "form", busy: true, invalid: null };
      }
      return { kind: "result", request: state.request };
    case "error":
      if (state.outcome.cause === "invalidNumber") return { kind: "form", busy: false, invalid: { diagnosis: null, attempt: 0 } };
      return { kind: "result", request: state.outcome.request };
    case "settled":
      return { kind: "result", request: state.outcome.request };
  }
}

export function viewModeOf(display: LookupDisplay, phase: LookupState["phase"]): ViewMode {
  if (display.kind === "form") {
    if (display.invalid !== null) return "error";
    return display.busy ? "loading" : "idle";
  }
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
