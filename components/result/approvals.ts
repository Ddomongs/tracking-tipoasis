import { siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { ActionKind, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";

/**
 * Roadmap §4 ledger values the result area needs. tests/unit/result-approvals.spec.ts fails when this and the ledger
 * disagree; Task 13 of the S07 plan flips approval3 when the operator records approval 3. Lazy chunk only (it pulls in
 * deriveTrackingView): reached through result-module.ts.
 */
export interface ResultApprovals {
  /** 승인 3: the cause's recovery action leads error screens. Until then 톡톡 is the filled primary and [번호 수정]/[다시 조회] are secondary. */
  readonly approval3: boolean;
}

/** Approval 3 is recorded in roadmap §4: the cause's recovery action leads the error card (spec §16 item 3). */
export const RESULT_APPROVALS: ResultApprovals = { approval3: true };

const RECOVERY_KINDS: ReadonlySet<ActionKind> = new Set<ActionKind>(["fixNumber", "retry"]);

/** Approval-3 fallback: 톡톡 becomes the filled primary; the recovery action moves to the secondaries (as S04's R2 slot did). */
function withTalkFirst(view: TrackingViewModel): TrackingViewModel {
  const { primary, secondary } = view.nextAction;
  if (view.mode !== "error" || primary === null || !RECOVERY_KINDS.has(primary.kind)) return view;
  const talk = secondary.find((action) => action.kind === "talk");
  if (talk === undefined) return view;
  return {
    ...view,
    nextAction: {
      ...view.nextAction,
      primary: { ...talk, weight: "primary" },
      secondary: [{ ...primary, weight: "secondary" }, ...secondary.filter((action) => action !== talk)]
    }
  };
}

export function applyResultApprovals(view: TrackingViewModel, approvals: ResultApprovals): TrackingViewModel {
  return approvals.approval3 ? view : withTalkFirst(view);
}

/** The view the customer page renders for a settled lookup; `now` is the client's clock when it settled (spec §6 overdue). */
export function deriveResultView(outcome: LookupOutcome, now: Date): TrackingViewModel {
  return applyResultApprovals(deriveTrackingView(outcome, now, siteConfig), RESULT_APPROVALS);
}
