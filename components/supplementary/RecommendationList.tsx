"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/primitives/Button";
import { ButtonLink } from "@/components/primitives/ButtonLink";
import { channels, resultCopy } from "@/config/site.config";
import type { SelectedRecommendation } from "@/lib/tracking/recommendations";
import type { RecommendationContext } from "@/lib/tracking/types";

/** Spec §16 item 10 "거절하면": the dialog stays, labelled '운영자 추천', without price, discount or review labels. */
const OPERATOR_PICKS_LABEL = "운영자 추천";

export interface RecommendationListProps {
  readonly context: RecommendationContext;
  readonly items: readonly SelectedRecommendation[];
  readonly disclosure: string;
}

/**
 * Recommendations after a settled result (spec §8 "추천"). Until approval 10 the operator's picks sit in a native modal
 * <dialog> the customer opens (focus is trapped and Escape closes it natively). The links exist only while it is open,
 * so a result carries exactly the store links its view allows, and the affiliate disclosure is the first line above them.
 */
export function RecommendationList({ context, items, disclosure }: RecommendationListProps): React.JSX.Element | null {
  const baseId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);
  const titleId = `${baseId}-title`;
  const dialogTitleId = `${baseId}-dialog-title`;
  const triggerId = `${baseId}-open`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (items.length === 0) return null;
  const hasAffiliate = items.some((entry) => entry.item.isAffiliate);

  // Runs for Escape (native close) and for 닫기 (state → effect → close): state follows, focus goes back to the trigger.
  const handleClosed = (): void => {
    setOpen(false);
    document.getElementById(triggerId)?.focus();
  };

  return (
    <section
      data-recommended-products={context}
      aria-labelledby={titleId}
      className="flex flex-col gap-3 border-t-2 border-tt-ink bg-tt-surface px-[var(--tt-gutter)] py-4 text-tt-ink"
    >
      <h2 id={titleId} className="m-0 text-tt-lg font-bold [word-break:keep-all]">
        {OPERATOR_PICKS_LABEL}
      </h2>
      <Button id={triggerId} variant="secondary" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {resultCopy.recommendationsOpen}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        onClose={handleClosed}
        className="m-auto w-[calc(100%_-_2rem)] max-w-[480px] border-2 border-tt-ink bg-tt-surface p-0 text-tt-ink"
      >
        <div className="flex flex-col gap-3 p-5">
          <h2 id={dialogTitleId} className="m-0 text-tt-lg font-bold [word-break:keep-all]">
            {OPERATOR_PICKS_LABEL}
          </h2>
          {open ? (
            <>
              {hasAffiliate ? <p data-affiliate-disclosure="coupang">{disclosure}</p> : null}
              <ul className="m-0 flex list-none flex-col p-0">
                {items.map(({ item }) => (
                  <li key={item.id} className="flex flex-col gap-1 border-t border-tt-rule py-2">
                    <ButtonLink href={item.href} variant="text" external sponsored={item.isAffiliate} label={item.name} />
                    <span className="text-tt-xs text-tt-muted">{channels[item.channel].name}</span>
                  </li>
                ))}
              </ul>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {resultCopy.recommendationsClose}
              </Button>
            </>
          ) : null}
        </div>
      </dialog>
    </section>
  );
}
