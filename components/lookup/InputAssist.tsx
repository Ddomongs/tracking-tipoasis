"use client";

import { Button } from "@/components/primitives/Button";
import { pasteCarrierNotice, type ConfusableHint } from "@/lib/tracking/number-input";

export const INPUT_ASSIST_ID = "tracking-input-assist";
const UNDO_LABEL = "되돌리기";

/**
 * Help right under the input (spec §4): the paste notice '택배사를 CJ대한통운으로 맞췄어요' with [되돌리기], and the
 * question asked before submitting when a letter O, I or l probably meant a digit (WCAG 3.3.3). Referenced by the
 * input's aria-describedby while it is shown; never a live region itself.
 */
export function InputAssist({
  confusable,
  pastedCarrierName,
  onUndo
}: {
  readonly confusable: ConfusableHint;
  readonly pastedCarrierName: string | null;
  readonly onUndo: () => void;
}): React.JSX.Element | null {
  if (confusable === null && pastedCarrierName === null) return null;
  return (
    <div id={INPUT_ASSIST_ID} className="mt-1.5 flex flex-col gap-0.5 text-tt-sm text-tt-ink">
      {pastedCarrierName === null ? null : (
        <p className="m-0 flex flex-wrap items-center gap-x-2 [word-break:keep-all]">
          <span>{pasteCarrierNotice(pastedCarrierName)}</span>
          <Button variant="text" onClick={onUndo}>
            {UNDO_LABEL}
          </Button>
        </p>
      )}
      {confusable === null ? null : (
        <p className="m-0 font-bold text-tt-attention-ink [word-break:keep-all]">{confusable.message}</p>
      )}
    </div>
  );
}
