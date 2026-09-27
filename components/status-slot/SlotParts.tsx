"use client";

import { useEffect, useState } from "react";
import type { ActionView, ActionWeight, NoticeView, NumberView, ResultAction, Tone, TrackingViewModel } from "@/lib/tracking/types";

// Transitional parts shared by the R2 status slot and CustomerCta (deleted by S07 with components/status-slot/). Light surface inside
// the lookup card. Weights come from the view; one filled button per screen is the view's rule (spec §13 버튼 계층).

/** Actions the customer can take alone; on error screens the card shows them and the CTA block shows 톡톡 (spec §16 item 3). */
export const RECOVERY_KINDS: ReadonlySet<ActionView["kind"]> = new Set<ActionView["kind"]>(["fixNumber", "retry"]);

export const TONE_BORDER: Readonly<Record<Tone, string>> = {
  neutral: "border-slate-200",
  progress: "border-cyan-300",
  waiting: "border-slate-300",
  attention: "border-amber-400",
  problem: "border-rose-400",
  done: "border-emerald-400"
};

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2";
const WEIGHT_CLASS: Readonly<Record<ActionWeight, string>> = {
  primary: `inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 ${FOCUS_RING}`,
  secondary: `inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-400 bg-white px-4 text-sm font-semibold text-slate-900 hover:border-slate-700 ${FOCUS_RING}`,
  text: `inline-flex min-h-6 items-center text-sm font-semibold text-cyan-800 underline underline-offset-2 hover:text-cyan-950 ${FOCUS_RING}`
};
const COOLDOWN_TICK_MS = 1000;

export function actionClassName(weight: ActionWeight): string {
  return `${WEIGHT_CLASS[weight]} aria-disabled:cursor-not-allowed aria-disabled:opacity-60`;
}

type ExternalTarget = Extract<ResultAction, { kind: "openedExternal" }>["target"];

function externalTarget(kind: ActionView["kind"]): ExternalTarget {
  if (kind === "talk" || kind === "copyAndTalk") return "talk";
  if (kind === "callDriver") return "driver";
  if (kind === "carrierOfficial") return "carrier";
  return "store";
}

function inPageAction(kind: ActionView["kind"]): ResultAction | null {
  if (kind === "fixNumber") return { kind: "fixNumber" };
  if (kind === "retry") return { kind: "retry" };
  if (kind === "cancel") return { kind: "cancel" };
  return null;
}

/** Seconds left before a 429 retry may run: the view's cooldown counted down (spec §5: 10 s, then enabled; no automatic retry). */
function useCooldown(seconds: number | null): number {
  const [remaining, setRemaining] = useState(seconds ?? 0);
  useEffect(() => {
    if (seconds === null || seconds <= 0) return undefined;
    const endsAt = Date.now() + seconds * 1000;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) window.clearInterval(timer);
    }, COOLDOWN_TICK_MS);
    return () => window.clearInterval(timer);
  }, [seconds]);
  return remaining;
}

export function ActionControl({
  action,
  onAction
}: {
  readonly action: ActionView;
  readonly onAction: (action: ResultAction) => void;
}): React.JSX.Element | null {
  const remaining = useCooldown(action.cooldownSeconds);
  if (action.href !== null) {
    return (
      <a
        href={action.href}
        target={action.external ? "_blank" : undefined}
        rel={action.external ? "noopener noreferrer" : undefined}
        aria-label={action.external ? `${action.label} 새 창으로 열기` : undefined}
        data-action-kind={action.kind}
        data-action-weight={action.weight}
        className={actionClassName(action.weight)}
        onClick={() => onAction({ kind: "openedExternal", target: externalTarget(action.kind) })}
      >
        {action.label}
      </a>
    );
  }
  const result = inPageAction(action.kind);
  if (result === null) return null;
  const cooling = remaining > 0;
  return (
    <button
      type="button"
      aria-disabled={cooling || undefined}
      data-action-kind={action.kind}
      data-action-weight={action.weight}
      className={actionClassName(action.weight)}
      onClick={() => {
        if (!cooling) onAction(result);
      }}
    >
      {action.label}
      {cooling ? (
        <span aria-hidden="true" className="ml-1 tabular-nums">
          ({remaining})
        </span>
      ) : null}
    </button>
  );
}

export function NumberLine({ number, carrierLabel }: { readonly number: NumberView; readonly carrierLabel: string }): React.JSX.Element {
  return (
    <p className="break-keep text-sm text-slate-600">
      조회번호 <span className="whitespace-nowrap font-mono font-semibold tabular-nums text-slate-900">{number.grouped}</span> · {carrierLabel}
    </p>
  );
}

/** '확인 필요 · 2/4' renders as two spans so the state word stays a text of its own. */
export function ChipLine({ chip }: { readonly chip: string }): React.JSX.Element {
  const [state, position] = chip.split(" · ");
  return (
    <p className="text-sm font-semibold text-slate-700">
      <span>{state}</span>
      {position ? <span className="tabular-nums"> · {position}</span> : null}
    </p>
  );
}

/** The in-card '안내' line (spec §6: a state notice lives inside the card, never between the blocks). Never a live region. */
export function NoticeLine({ notice }: { readonly notice: NoticeView }): React.JSX.Element {
  return (
    <p data-notice-kind={notice.kind} className="break-keep rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800">
      <span className="font-semibold">안내</span> {notice.title} · {notice.body}
    </p>
  );
}

export function AuxiliaryLine({
  line,
  onAction
}: {
  readonly line: NonNullable<TrackingViewModel["auxiliaryLine"]>;
  readonly onAction: (action: ResultAction) => void;
}): React.JSX.Element {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 break-keep text-sm text-slate-700">
      <span>{line.text}</span>
      {line.action ? <ActionControl action={line.action} onAction={onAction} /> : null}
    </p>
  );
}
