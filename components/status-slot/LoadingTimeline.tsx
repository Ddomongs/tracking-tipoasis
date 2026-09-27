"use client";

import type { LoadingViewModel } from "@/lib/tracking/types";

// Transitional (S07 moves it to components/result/LoadingCard.tsx). Nothing here is a live region: useLookup announces the stage
// sentences through LiveAnnouncer. The skeleton is static (no shimmer) and the spinner stops at 5 s or never turns with reduced motion.

const SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-400 bg-white px-4 text-sm font-semibold text-slate-900 hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2";
const TEXT_LINK =
  "inline-flex min-h-6 items-center text-sm font-semibold text-cyan-800 underline underline-offset-2 hover:text-cyan-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2";

export function LoadingTimeline({
  loading,
  onCancel
}: {
  readonly loading: LoadingViewModel;
  readonly onCancel: () => void;
}): React.JSX.Element {
  return (
    <div
      data-loading-stage={loading.stage}
      aria-busy="true"
      className="space-y-3 rounded-2xl border-2 border-slate-200 bg-white p-4 text-slate-900"
    >
      <p className="break-keep text-sm text-slate-600">
        조회번호 <span className="whitespace-nowrap font-mono font-semibold tabular-nums text-slate-900">{loading.number.grouped}</span> ·{" "}
        {loading.carrier.barLabel}
      </p>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          data-spinner={loading.spinnerActive ? "on" : "off"}
          className={`inline-block h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 border-t-slate-900 ${
            loading.spinnerActive ? "animate-spin" : ""
          }`}
        />
        <h2 className="break-keep text-lg font-bold">{loading.title}</h2>
      </div>
      <p className="break-keep text-sm leading-6 text-slate-700">{loading.body}</p>
      {loading.outageNotice ? (
        <p data-notice-kind={loading.outageNotice.kind} className="break-keep rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">
          <span className="font-semibold">안내</span> {loading.outageNotice.title} · {loading.outageNotice.body}
        </p>
      ) : null}
      {loading.extra ? <p className="break-keep text-sm font-semibold leading-6 text-slate-900">{loading.extra}</p> : null}
      {loading.elapsedText ? <p className="text-sm tabular-nums text-slate-600">{loading.elapsedText}</p> : null}
      {loading.cancel || loading.carrierOfficial?.href ? (
        <div className="flex flex-wrap items-center gap-3">
          {loading.cancel ? (
            <button type="button" onClick={onCancel} className={SECONDARY}>
              {loading.cancel.label}
            </button>
          ) : null}
          {loading.carrierOfficial?.href ? (
            <a
              href={loading.carrierOfficial.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${loading.carrierOfficial.label} 새 창으로 열기`}
              className={TEXT_LINK}
            >
              {loading.carrierOfficial.label}
            </a>
          ) : null}
        </div>
      ) : null}
      <div aria-hidden="true" data-loading-skeleton="true" className="space-y-2">
        <div className="h-16 rounded-xl bg-slate-100" />
        <div className="h-24 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
