import { compactTrackingNumber } from "@/lib/tracking/number-format";
import type { NumberView } from "@/lib/tracking/types";

const NUMBER_LABEL = "조회번호";

/**
 * Number bar (spec §6): '조회번호 · {carrier}' above the number in monospace, written without spaces so it copies as
 * one piece (10월 4일 요청: the 4-character groups made copying awkward). Nothing is truncated; a number too long for
 * the row wraps anywhere.
 * Actions ([번호 변경], [번호 수정], [다시 조회]) sit on the right and wrap below the number when the row is too narrow.
 */
export function NumberBar({
  number,
  carrierLabel,
  actions
}: {
  readonly number: NumberView;
  readonly carrierLabel: string;
  readonly actions?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      data-number-bar="true"
      className="flex min-h-[56px] flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-tt-surface px-[var(--tt-gutter)] py-1.5 text-tt-ink"
    >
      <p className="m-0 flex min-w-0 max-w-full flex-col">
        <span className="text-tt-xs font-medium text-tt-muted [word-break:keep-all]">{`${NUMBER_LABEL} · ${carrierLabel}`}</span>
        <span
          data-number-bar-value="true"
          className="block font-tt-mono text-tt-lg font-medium leading-6 tracking-[0.02em] [font-variant-numeric:tabular-nums] [overflow-wrap:anywhere]"
        >
          {compactTrackingNumber(number.grouped)}
        </span>
      </p>
      {actions ? (
        <div data-number-bar-actions="true" className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
