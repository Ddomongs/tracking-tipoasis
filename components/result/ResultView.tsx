"use client";

import { useId } from "react";
import { channels } from "@/config/site.config";
import { ButtonLink } from "@/components/primitives/ButtonLink";
import { PROBLEM_GUIDE_KEYS } from "@/lib/tracking/types";
import type { FailureCause, HelpItemView, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import { ActionControl } from "./ActionControl";
import { CarrierChooser } from "./CarrierChooser";
import { DeliveredHelp, UNDELIVERED_HELP_ITEM_ID } from "./DeliveredHelp";
import { FailureCard } from "./FailureCard";
import { helpDetailsId } from "./HelpItems";
import { HistoryDetails } from "./HistoryDetails";
import { LastEventLine } from "./LastEventLine";
import { NextActionBlock, type HelpLink } from "./NextActionBlock";
import { SideColumn } from "./SideColumn";
import { StatusCard } from "./StatusCard";
import { StickySummary } from "./StickySummary";

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
  /** The store invitation under a normal result (staff-edited site settings, 10월 2일 요청). */
  readonly promo?: ResultPromo | null;
}

export interface ResultPromo {
  readonly title: string;
  readonly body: string;
  readonly linkLabel: string;
  readonly href: string;
}

const PROBLEM_KEYS: ReadonlySet<string> = new Set(PROBLEM_GUIDE_KEYS);

/**
 * Only where the result carries no store links of its own and nothing is wrong (spec §8: no store link in a problem
 * state; pending and delivered already lead with their stores). No 톡톡 link: the screen keeps header, state place, footer.
 */
function showsPromo(view: TrackingViewModel): boolean {
  return view.mode === "settled" && !view.overdue && !PROBLEM_KEYS.has(view.guideKey) && view.nextAction.stores === null;
}

function ResultPromoCard({ promo, id }: { readonly promo: ResultPromo; readonly id: string }): React.JSX.Element {
  return (
    <aside
      data-result-promo="true"
      aria-labelledby={id}
      className="flex flex-col gap-3 border-0 border-l-4 border-solid border-tt-accent bg-tt-surface px-4 py-5"
    >
      <p className="m-0 text-tt-xs font-bold text-tt-accent">구매대행 · 해외 직구</p>
      <h3 id={id} className="m-0 text-tt-lg [font-weight:var(--tt-weight-display)] [word-break:keep-all]">
        {promo.title}
      </h3>
      <p className="m-0 text-tt-sm [word-break:keep-all]">{promo.body}</p>
      <div>
        <ButtonLink href={promo.href} variant="secondary" external label={promo.linkLabel} />
      </div>
    </aside>
  );
}

/**
 * One column below 1024 px; from 1024 px the 560 px result with the 320 px side column (spec §3 데스크톱). At least as tall
 * as the viewport under the header and number bar (48 + 56 px = 6.5rem), so nothing below moves into view when the
 * result replaces the loading card (CLS ≤ 0.05).
 */
const RESPONSIVE_LAYOUT =
  "mx-auto flex min-h-[calc(100svh_-_6.5rem)] w-full flex-col gap-4 lg:grid lg:w-[calc(var(--tt-column)_+_var(--tt-side)_+_2rem)] lg:max-w-full lg:grid-cols-[minmax(0,var(--tt-column))_var(--tt-side)] lg:items-start lg:gap-8";
/** The CS preview's phone frame: one 375 px column at any window width. */
const MOBILE_FRAME_LAYOUT = "mx-auto flex w-full max-w-[375px] flex-col gap-4";

type ExternalTarget = Extract<ResultAction, { kind: "openedExternal" }>["target"];

const ignoreAction = (): void => undefined;


/** config help id the pending purchase choices point to (spec §7 pending "'주문내역에서 확인' 도움말", approval 4). */
const ORDER_CHECK_HELP_ID = "order-check";

function pendingHelpLink(view: TrackingViewModel, baseId: string): HelpLink | null {
  if (view.guideKey !== "pending") return null;
  const item = view.help.find((help) => help.id === ORDER_CHECK_HELP_ID);
  return item === undefined ? null : { id: helpDetailsId(baseId, item.id), helpId: item.id, label: item.summary };
}

/** Which outside place a result link opens (reported for analytics, S11). */
function externalTarget(anchor: HTMLAnchorElement): ExternalTarget | null {
  const href = anchor.getAttribute("href") ?? "";
  if (href.startsWith("tel:")) return "driver";
  if (anchor.target !== "_blank") return null;
  if (href === channels.talk.url) return "talk";
  if (anchor.closest("[data-affiliate-group], [data-recommended-products]") !== null) return "store";
  return "carrier";
}

function reportExternal(event: React.MouseEvent<HTMLElement>, onAction: (action: ResultAction) => void): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return;
  const kind = externalTarget(anchor);
  if (kind !== null) onAction({ kind: "openedExternal", target: kind });
}

/** Read-only (CS preview): swallow activation of links, buttons, radios and chip labels before any handler runs. */
function blockActivation(event: React.MouseEvent<HTMLElement>): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest("a[href], button, input, label") === null) return;
  event.preventDefault();
  event.stopPropagation();
}

function AuxiliaryLine({
  view,
  onAction
}: {
  readonly view: TrackingViewModel;
  readonly onAction: (action: ResultAction) => void;
}): React.JSX.Element | null {
  const line = view.auxiliaryLine;
  if (line === null) return null;
  return (
    <p data-auxiliary-line="true" className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-tt-sm font-medium [word-break:keep-all]">
      <span>{line.text}</span>
      {line.action === null ? null : (
        <ActionControl action={line.action} onAction={onAction} inquiryCopy={view.inquiryCopy} returnLink={view.returnLink} undeliveredHelpId={null} />
      )}
    </p>
  );
}

interface SettledFlowProps {
  readonly view: TrackingViewModel;
  readonly baseId: string;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef?: React.Ref<HTMLHeadingElement>;
  readonly recommendationSlot?: React.ReactNode;
}

/**
 * 상태 카드 → 도착 예상 → 지금 할 일 → 마지막 처리 (data-primary-end) → 처리 내역 (spec §6). Recommendations come right
 * after the marker for delivered (spec §7 "CTA 바로 아래") and after 처리 내역 otherwise — never between the fixed blocks.
 */
function SettledFlow({ view, baseId, onAction, headingRef, recommendationSlot }: SettledFlowProps): React.JSX.Element {
  const undelivered: HelpItemView | null = view.help.find((item) => item.id === UNDELIVERED_HELP_ITEM_ID) ?? null;
  const undeliveredId = `${baseId}-undelivered`;
  const choices = view.nextAction.carrierChoices;
  const hasRecommendations = view.revenue.recommendations !== "none" && recommendationSlot !== undefined && recommendationSlot !== null;
  const recommendations = hasRecommendations ? <div data-recommendation-slot="true">{recommendationSlot}</div> : null;
  const recommendationsLead = view.guideKey === "delivered";
  return (
    <>
      <StatusCard view={view} titleId={`${baseId}-title`} headingRef={headingRef}>
        <AuxiliaryLine view={view} onAction={onAction} />
      </StatusCard>
      <NextActionBlock
        view={view}
        headingId={`${baseId}-next`}
        onAction={onAction}
        undeliveredHelpId={undelivered === null ? null : undeliveredId}
        carrierChooser={
          choices === null ? undefined : (
            <CarrierChooser choices={choices} onChoose={(carrier) => onAction({ kind: "chooseCarrier", carrier })} />
          )
        }
        helpLink={pendingHelpLink(view, baseId)}
      />
      <LastEventLine lastEvent={view.lastEvent} />
      <div data-primary-end="true" aria-hidden="true" />
      {recommendationsLead ? recommendations : null}
      <HistoryDetails history={view.history} id={`${baseId}-history`} />
      {undelivered === null ? null : <DeliveredHelp item={undelivered} id={undeliveredId} contact={view.nextAction.contact} />}
      {recommendationsLead ? null : recommendations}
    </>
  );
}

/**
 * The result area (spec §6–§7), loaded lazily through result-module.ts. It renders only the view model: the settled
 * flow with its side column, or the failure card for error views. The number bar above it belongs to the caller.
 */
export function ResultView({
  view,
  onAction,
  headingRef,
  recommendationSlot,
  readOnly = false,
  frame = "responsive",
  failureCause,
  promo = null
}: ResultViewProps): React.JSX.Element {
  const baseId = useId();
  const act = readOnly ? ignoreAction : onAction;
  const otherHelp = view.help.filter((item) => item.id !== UNDELIVERED_HELP_ITEM_ID);
  return (
    <div
      data-result-view={view.mode}
      data-ad-exclude="true"
      data-frame={frame}
      data-read-only={readOnly ? "true" : undefined}
      onClickCapture={readOnly ? blockActivation : undefined}
      onClick={readOnly ? undefined : (event) => reportExternal(event, onAction)}
      className={frame === "mobile" ? MOBILE_FRAME_LAYOUT : RESPONSIVE_LAYOUT}
    >
      <div data-result-main="true" className="flex min-w-0 flex-col gap-4">
        {view.mode === "error" ? (
          <FailureCard
            view={view}
            titleId={`${baseId}-title`}
            ctaHeadingId={`${baseId}-next`}
            onAction={act}
            headingRef={headingRef}
            failureCause={failureCause}
          />
        ) : (
          <SettledFlow view={view} baseId={baseId} onAction={act} headingRef={headingRef} recommendationSlot={recommendationSlot} />
        )}
        {promo !== null && !readOnly && showsPromo(view) ? <ResultPromoCard promo={promo} id={`${baseId}-promo`} /> : null}
      </div>
      {view.mode === "error" ? null : (
        <SideColumn view={view} frame={frame} historyId={`${baseId}-history`} help={otherHelp} helpIdPrefix={baseId} />
      )}
      {/* The band under the sticky header (10월 2일 요청); lives in this lazy chunk, never in the CS preview. */}
      {readOnly || frame === "mobile" || view.mode === "error" ? null : <StickySummary view={view} />}
    </div>
  );
}
