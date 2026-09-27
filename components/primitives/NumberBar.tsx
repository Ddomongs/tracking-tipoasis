import { Fragment } from "react";
import type { NumberView } from "@/lib/tracking/types";

const NUMBER_LABEL = "조회번호";

/**
 * Number bar (spec §6): '조회번호 · {carrier}' above the number in 4-character monospace groups.
 * A group never breaks and nothing is truncated; the number wraps only between groups.
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
  const groups = number.grouped.split(" ").filter((group) => group !== "");
  return (
    <div
      data-number-bar="true"
      className="flex min-h-[56px] flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-tt-surface px-[var(--tt-gutter)] py-1.5 text-tt-ink"
    >
      <p className="m-0 flex min-w-0 max-w-full flex-col">
        <span className="text-tt-xs font-medium text-tt-muted [word-break:keep-all]">{`${NUMBER_LABEL} · ${carrierLabel}`}</span>
        <span
          data-number-bar-value="true"
          className="block font-tt-mono text-tt-lg font-medium leading-6 tracking-[0.02em] [font-variant-numeric:tabular-nums]"
        >
          {groups.map((group, index) => (
            <Fragment key={`${index}-${group}`}>
              {index > 0 ? " " : null}
              <span className="whitespace-nowrap">{group}</span>
            </Fragment>
          ))}
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
