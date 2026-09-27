"use client";

import { LoadingTimeline } from "@/components/status-slot/LoadingTimeline";
import type { LookupState } from "@/lib/tracking/lookup-state";
import type { LoadingViewModel, ResultAction, TrackingViewModel } from "@/lib/tracking/types";

// Transitional (contract §11.9; deleted by S07). One slot directly under the lookup form: loading, then the error or the result, in the
// same place (spec §2 원칙 1, §5). This task renders the loading card; Tasks 5 and 6 of the S04 plan add errors and results.

export interface StatusSlotProps {
  readonly state: LookupState;
  readonly loading: LoadingViewModel | null;
  readonly view: TrackingViewModel | null;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>;
}

export function StatusSlot({ state, loading, onAction }: StatusSlotProps): React.JSX.Element | null {
  if (state.phase !== "loading") return null;
  // 0–0.4 s: only the submit label changes (spec §5); from 0.4 s the loading card fills the slot.
  if (loading === null || loading.stage === "instant") return null;
  return (
    <div data-status-slot="loading" className="mt-5">
      <LoadingTimeline loading={loading} onCancel={() => onAction({ kind: "cancel" })} />
    </div>
  );
}
