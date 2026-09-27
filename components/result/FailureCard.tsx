"use client";

import { INVALID_NUMBER_ERROR_ID } from "@/components/lookup/LookupForm";
import { ActionControl, AuxiliaryLine, ChipLine, NoticeLine, NumberLine, RECOVERY_KINDS, TONE_BORDER } from "@/components/status-slot/SlotParts";
import type { ActionView, FailureCause, ResultAction, TrackingViewModel } from "@/lib/tracking/types";

// Transitional (S07 moves it to components/result/FailureCard.tsx). The card names the cause and holds the customer's own recovery
// action; 톡톡 is the first link of the CTA block below. role="alert" is only on the error sentence, never on the focused heading.

export interface FailureNoticeProps {
  readonly view: TrackingViewModel;
  readonly cause: FailureCause;
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>;
  readonly onAction: (action: ResultAction) => void;
}

export function FailureNotice({ view, cause, headingRef, onAction }: FailureNoticeProps): React.JSX.Element {
  const recovery = [view.nextAction.primary, ...view.nextAction.secondary].filter(
    (action): action is ActionView => action !== null && RECOVERY_KINDS.has(action.kind)
  );
  const invalid = view.guideKey === "invalidNumber";
  return (
    <div
      data-failure-cause={cause}
      data-guide-key={view.guideKey}
      data-overdue="false"
      data-tone={view.tone}
      className={`space-y-3 rounded-2xl border-2 bg-white p-4 text-slate-900 ${TONE_BORDER[view.tone]}`}
    >
      <NumberLine number={view.number} carrierLabel={view.carrier.barLabel} />
      {view.chip ? <ChipLine chip={view.chip} /> : null}
      {invalid ? (
        // The input keeps focus and points here with aria-describedby (spec §5 INVALID).
        <p id={INVALID_NUMBER_ERROR_ID} role="alert" className="break-keep text-base font-semibold leading-7">
          {view.title}
        </p>
      ) : (
        <>
          <h2 ref={headingRef} tabIndex={-1} className="break-keep text-xl font-bold leading-snug outline-none">
            {view.title}
          </h2>
          {view.reason ? (
            <p role="alert" className="break-keep text-sm leading-6 text-slate-800">
              {view.reason}
            </p>
          ) : null}
        </>
      )}
      {view.notice ? <NoticeLine notice={view.notice} /> : null}
      {recovery.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {recovery.map((action) => (
            <ActionControl key={`${action.kind}-${action.weight}`} action={action} onAction={onAction} />
          ))}
        </div>
      ) : null}
      {view.auxiliaryLine ? <AuxiliaryLine line={view.auxiliaryLine} onAction={onAction} /> : null}
    </div>
  );
}
