"use client";

import { AuxiliaryLine, ChipLine, NoticeLine, NumberLine, TONE_BORDER } from "@/components/status-slot/SlotParts";
import { resultCopy } from "@/config/site.config";
import type { EtaView, ResultAction, SpineView, StationId, TrackingViewModel } from "@/lib/tracking/types";

// Transitional (deleted by S07; ResultView replaces it). Status card, 4-station journey and the arrival estimate, in the spec §6 order.
// The estimate date is the largest text (32–40 px); the spine has exactly one aria-current="step", none before the location is known.

const STATIONS: readonly StationId[] = ["departed", "customs", "domestic", "arrived"];
const STATION_LABELS: Readonly<Record<StationId, string>> = {
  departed: resultCopy.stationDeparted,
  customs: resultCopy.stationCustoms,
  domestic: resultCopy.stationDomestic,
  arrived: resultCopy.stationArrived
};
const SPINE_LABEL = "배송 여정 4구간";
const HANDOFF_PENDING = "인계 대기";
const POSITION_UNKNOWN = "위치 확인 전";

type StationState = "done" | "current" | "todo";

const STATION_CLASS: Readonly<Record<StationState, string>> = {
  done: "border-slate-300 bg-slate-100 text-slate-800",
  current: "border-slate-900 bg-slate-900 font-semibold text-white",
  todo: "border-dashed border-slate-300 bg-white text-slate-600"
};

function stationState(index: number, currentIndex: number): StationState {
  if (currentIndex < 0 || index > currentIndex) return "todo";
  return index === currentIndex ? "current" : "done";
}

function Spine({ spine }: { readonly spine: SpineView }): React.JSX.Element {
  const currentIndex = spine.current === null ? -1 : STATIONS.indexOf(spine.current);
  return (
    <div className="space-y-1">
      <ol aria-label={SPINE_LABEL} data-spine-current={spine.current ?? "none"} className="grid grid-cols-4 gap-1 text-center text-xs">
        {STATIONS.map((station, index) => {
          const state = stationState(index, currentIndex);
          const issue = spine.issue !== null && spine.issue.at === station ? spine.issue : null;
          return (
            <li
              key={station}
              data-station={station}
              data-station-state={state}
              data-issue={issue?.kind}
              aria-current={state === "current" ? "step" : undefined}
              className={`rounded-lg border px-1 py-2 ${STATION_CLASS[state]} ${issue ? "ring-2 ring-amber-400" : ""}`}
            >
              <span className="block break-keep">{STATION_LABELS[station]}</span>
              {state === "current" && spine.handoffPending ? <span className="block">{HANDOFF_PENDING}</span> : null}
              {issue ? <span className="block font-bold">{issue.label}</span> : null}
            </li>
          );
        })}
      </ol>
      {spine.current === null ? <p className="text-xs text-slate-600">{POSITION_UNKNOWN}</p> : null}
    </div>
  );
}

function BigDate({ label, muted = false }: { readonly label: string; readonly muted?: boolean }): React.JSX.Element {
  return (
    <p
      className={`break-keep text-[2rem] font-black leading-none tracking-tight tabular-nums sm:text-[2.5rem] ${
        muted ? "text-slate-500" : "text-slate-950"
      }`}
    >
      {label}
    </p>
  );
}

function Caption({ text }: { readonly text: string | null }): React.JSX.Element | null {
  return text === null ? null : <p className="break-keep text-sm text-slate-600">{text}</p>;
}

function EtaValue({ eta }: { readonly eta: Exclude<EtaView, { kind: "none" }> }): React.JSX.Element {
  switch (eta.kind) {
    case "date":
      return (
        <>
          <BigDate label={eta.date.label} />
          <p>
            <span className="inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold tabular-nums text-white">D-{eta.dday}</span>
          </p>
          <Caption text={eta.caption} />
        </>
      );
    case "today":
      return (
        <>
          <BigDate label={eta.date.label} />
          <Caption text={eta.caption} />
        </>
      );
    case "holidayAffected":
      return (
        <>
          <BigDate label={eta.date.label} />
          <p>
            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{eta.badge}</span>
          </p>
          <Caption text={eta.caption} />
        </>
      );
    case "overdue":
      return <BigDate label={eta.date.label} muted />;
    case "deliveredOn":
      return <BigDate label={eta.date.label} />;
    case "pendingInfo":
    case "withheld":
    case "unknown":
      return <p className="break-keep text-lg font-bold leading-snug">{eta.text}</p>;
  }
}

function EtaBlock({ eta }: { readonly eta: EtaView }): React.JSX.Element | null {
  if (eta.kind === "none") return null;
  return (
    <div data-eta-kind={eta.kind} className="space-y-2 rounded-xl bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-700">{eta.label}</p>
      <EtaValue eta={eta} />
    </div>
  );
}

export interface ResultSummaryProps {
  readonly view: TrackingViewModel;
  readonly headingRef: React.RefObject<HTMLHeadingElement | null>;
  readonly onAction: (action: ResultAction) => void;
}

export function ResultSummary({ view, headingRef, onAction }: ResultSummaryProps): React.JSX.Element {
  return (
    <div
      data-guide-key={view.guideKey}
      data-overdue={view.overdue ? "true" : "false"}
      data-tone={view.tone}
      className={`space-y-3 rounded-2xl border-2 bg-white p-4 text-slate-900 ${TONE_BORDER[view.tone]}`}
    >
      <NumberLine number={view.number} carrierLabel={view.carrier.barLabel} />
      {view.chip ? <ChipLine chip={view.chip} /> : null}
      <h2 ref={headingRef} tabIndex={-1} className="break-keep text-xl font-bold leading-snug outline-none">
        {view.title}
      </h2>
      {view.reason ? <p className="break-keep text-sm leading-6 text-slate-800">{view.reason}</p> : null}
      {view.notice ? <NoticeLine notice={view.notice} /> : null}
      <Spine spine={view.spine} />
      <EtaBlock eta={view.eta} />
      {view.auxiliaryLine ? <AuxiliaryLine line={view.auxiliaryLine} onAction={onAction} /> : null}
    </div>
  );
}
