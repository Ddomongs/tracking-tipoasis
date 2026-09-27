"use client";

import { CustomerCta, INLINE_HELP_IDS } from "@/components/CustomerCta";
import { FailureNotice } from "@/components/status-slot/FailureNotice";
import { LoadingTimeline } from "@/components/result/LoadingCard";
import { ResultSummary } from "@/components/status-slot/ResultSummary";
import type { LookupState } from "@/lib/tracking/lookup-state";
import type { HelpItemView, LastEventView, LoadingViewModel, ResultAction, TrackingViewModel } from "@/lib/tracking/types";

// Transitional (contract §11.9; deleted by S07). One slot directly under the lookup form: loading, then the error or the result, in the
// same place (spec §2 원칙 1, §5). Result order (spec §6): status card → 지금 할 일 → last event → help, all before any store or ad.

export interface StatusSlotProps {
  readonly state: LookupState;
  readonly loading: LoadingViewModel | null;
  readonly view: TrackingViewModel | null;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>;
}

function LastEventLine({ lastEvent }: { readonly lastEvent: LastEventView }): React.JSX.Element {
  return (
    <p data-last-event="true" className="break-keep text-sm text-slate-700">
      {lastEvent.text}
      {lastEvent.original ? <span className="ml-1 text-xs text-slate-500">({lastEvent.original})</span> : null}
    </p>
  );
}

function HelpList({ items }: { readonly items: readonly HelpItemView[] }): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <details key={item.id} open={item.defaultOpen} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
          <summary className="cursor-pointer font-semibold">{item.summary}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {item.body.map((line) => (
              <li key={line} className="break-keep">
                {line}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

export function StatusSlot({ state, loading, view, onAction, headingRef }: StatusSlotProps): React.JSX.Element | null {
  if (state.phase === "idle") return null;
  if (state.phase === "loading") {
    // 0–0.4 s: only the submit label changes (spec §5); from 0.4 s the loading card fills the slot.
    if (loading === null || loading.stage === "instant") return null;
    return (
      <div data-status-slot="loading" className="mt-5">
        <LoadingTimeline loading={loading} onCancel={() => onAction({ kind: "cancel" })} />
      </div>
    );
  }
  if (view === null) return null;
  const help = view.help.filter((item) => !INLINE_HELP_IDS.has(item.id));
  if (state.phase === "error") {
    return (
      <div data-status-slot="error" className="mt-5 space-y-4">
        <FailureNotice key={state.settledAt} view={view} cause={state.outcome.cause} headingRef={headingRef} onAction={onAction} />
        <CustomerCta key={`cta-${state.settledAt}`} variant="view" view={view} onAction={onAction} />
        <HelpList items={help} />
      </div>
    );
  }
  return (
    <div data-status-slot="settled" className="mt-5 space-y-4">
      <ResultSummary key={state.settledAt} view={view} headingRef={headingRef} onAction={onAction} />
      <CustomerCta key={`cta-${state.settledAt}`} variant="view" view={view} onAction={onAction} />
      {view.lastEvent ? <LastEventLine lastEvent={view.lastEvent} /> : null}
      <HelpList items={help} />
    </div>
  );
}
