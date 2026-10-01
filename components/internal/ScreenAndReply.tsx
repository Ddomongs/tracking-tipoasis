"use client";

import { useId } from "react";
import { NumberBar } from "@/components/primitives/NumberBar";
import { ResultView } from "@/components/result/ResultView";
import type { CsReply } from "@/lib/cs/cs-reply";
import type { FailureCause, TrackingViewModel } from "@/lib/tracking/types";
import { FIELD_CLASS, LABEL_CLASS } from "./ui";

/** ResultView is read-only here and never reports actions; the handler only satisfies its props. */
const ignoreAction = (): void => undefined;

export interface ScreenAndReplyProps {
  readonly view: TrackingViewModel;
  readonly reply: CsReply;
  readonly failureCause?: FailureCause;
}

/**
 * The customer's screen in a 375 px phone frame — S05's NumberBar over S07's read-only ResultView, exactly what the
 * customer page renders for this view — next to the two CS replies built from the same view (spec §10).
 */
export function ScreenAndReply({ view, reply, failureCause }: ScreenAndReplyProps): React.JSX.Element {
  const id = useId();
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div data-preview-frame="375" className="w-[375px] max-w-full shrink-0 overflow-hidden border-2 border-solid border-tt-rule bg-tt-ground">
        <NumberBar number={view.number} carrierLabel={view.carrier.barLabel} />
        <ResultView view={view} onAction={ignoreAction} readOnly frame="mobile" failureCause={failureCause} />
      </div>
      <div data-reply-pair="true" className="flex min-w-0 flex-1 flex-col gap-2">
        <label htmlFor={`${id}-short`} className={LABEL_CLASS}>
          짧은 답변
        </label>
        <textarea id={`${id}-short`} readOnly value={reply.short} rows={4} className={FIELD_CLASS} />
        <label htmlFor={`${id}-long`} className={LABEL_CLASS}>
          자세한 답변
        </label>
        <textarea id={`${id}-long`} readOnly value={reply.long} rows={9} className={FIELD_CLASS} />
      </div>
    </div>
  );
}
