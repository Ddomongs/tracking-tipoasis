"use client";

import { useId } from "react";
import type { FailureCause, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import { StatusCard } from "./StatusCard";

export interface ResultViewProps {
  readonly view: TrackingViewModel;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef?: React.Ref<HTMLHeadingElement>;
  /** Placed per view.revenue.recommendations and guideKey; never between the fixed-order blocks. */
  readonly recommendationSlot?: React.ReactNode;
  /** CS preview: actions inert, no focus moves. */
  readonly readOnly?: boolean;
  /** "mobile" forces the 375 px single column (CS preview). */
  readonly frame?: "responsive" | "mobile";
  /** S07 addition: the cause behind an error view, for data-failure-cause on the failure card. */
  readonly failureCause?: FailureCause;
}

/**
 * The result area (spec §6–§7), loaded lazily through result-module.ts. It renders only the view model, in the fixed
 * order 상태 카드 → 도착 예상 → 지금 할 일 → 마지막 처리 → 처리 내역. The number bar above it belongs to the caller.
 */
export function ResultView({ view, headingRef, readOnly = false, frame = "responsive" }: ResultViewProps): React.JSX.Element {
  const baseId = useId();
  return (
    <div
      data-result-view={view.mode}
      data-ad-exclude="true"
      data-frame={frame}
      data-read-only={readOnly ? "true" : undefined}
      className="mx-auto flex w-full flex-col gap-4"
    >
      <div data-result-main="true" className="flex min-w-0 flex-col gap-4">
        <StatusCard view={view} titleId={`${baseId}-title`} headingRef={headingRef} />
      </div>
    </div>
  );
}
