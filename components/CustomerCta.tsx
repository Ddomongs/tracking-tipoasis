"use client";

import { useId } from "react";
import { ReturnLinkButton } from "@/components/ReturnLinkButton";
import { CopyInquiryButton } from "@/components/status-slot/CopyInquiryButton";
import { ActionControl, RECOVERY_KINDS, actionClassName } from "@/components/status-slot/SlotParts";
import { WorryLine } from "@/components/status-slot/WorryLine";
import type { ActionView, CarrierChoiceView, HelpItemView, ResultAction, StoreLinksView, TrackingViewModel } from "@/lib/tracking/types";

type CustomerCtaProps = {
  readonly variant: "view";
  readonly view: TrackingViewModel;
  readonly onAction: (action: ResultAction) => void;
};

// ---- View-driven "지금 할 일" block (S04; deleted by S07 with the file) ----

/** Help items this block shows inline ('받지 못하셨나요?'); StatusSlot leaves them out of its help list. */
export const INLINE_HELP_IDS: ReadonlySet<string> = new Set(["undelivered"]);
const RENDERED_SEPARATELY: ReadonlySet<ActionView["kind"]> = new Set<ActionView["kind"]>(["copyReturnLink", "undeliveredHelp"]);
const CARRIER_CHOICE_LEGEND = "택배사 선택";
const UNLABELLED_BLOCK_NAME = "지금 할 일";

/** Actions of the block in view order. On errors the card holds [번호 수정]/[다시 조회], so the block's first link is 톡톡. */
function ctaActions(view: TrackingViewModel): readonly ActionView[] {
  const listed = [view.nextAction.primary, ...view.nextAction.secondary].filter(
    (action): action is ActionView =>
      action !== null && !RENDERED_SEPARATELY.has(action.kind) && !(view.mode === "error" && RECOVERY_KINDS.has(action.kind))
  );
  // One plain 톡톡 link per block: the worry line carries it unless 톡톡 is the filled primary (spec §6 걱정 기준 → 톡톡).
  if (view.nextAction.worry === null) return listed;
  return listed.filter((action) => action.kind !== "talk" || action.weight === "primary");
}

/** Disclosure first, then the links (spec §8; isAffiliate alone decides rel="sponsored nofollow"). */
function StoreLinks({ stores }: { readonly stores: StoreLinksView }): React.JSX.Element {
  return (
    <div data-affiliate-group={stores.placement} className="space-y-2">
      {stores.disclosure ? (
        <p data-affiliate-disclosure="coupang" className="break-keep text-xs leading-5 text-slate-600">
          {stores.disclosure}
        </p>
      ) : null}
      {stores.intro ? <p className="break-keep text-sm text-slate-800">{stores.intro}</p> : null}
      <div className="flex flex-wrap gap-2">
        {stores.links.map((link) => (
          <a
            key={link.channel}
            href={link.href}
            target="_blank"
            rel={link.isAffiliate ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer"}
            aria-label={`${link.label} 새 창으로 열기`}
            data-link-placement={stores.placement}
            data-action-kind="store"
            data-action-weight={link.weight}
            className={actionClassName(link.weight)}
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function CarrierChoices({
  choices,
  onAction
}: {
  readonly choices: readonly CarrierChoiceView[];
  readonly onAction: (action: ResultAction) => void;
}): React.JSX.Element {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-slate-900">{CARRIER_CHOICE_LEGEND}</legend>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <button
            key={choice.code}
            type="button"
            data-carrier-choice={choice.code}
            className={actionClassName("secondary")}
            onClick={() => onAction({ kind: "chooseCarrier", carrier: choice.code })}
          >
            {choice.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function UndeliveredHelp({ summary, help }: { readonly summary: string; readonly help: HelpItemView }): React.JSX.Element {
  return (
    <details className="rounded-xl border border-slate-200 p-3 text-sm text-slate-800">
      <summary className="cursor-pointer font-semibold text-cyan-800">{summary}</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {help.body.map((line) => (
          <li key={line} className="break-keep">
            {line}
          </li>
        ))}
      </ul>
    </details>
  );
}

function CtaAction({
  action,
  view,
  onAction
}: {
  readonly action: ActionView;
  readonly view: TrackingViewModel;
  readonly onAction: (action: ResultAction) => void;
}): React.JSX.Element | null {
  if (action.kind === "copyAndTalk" && action.href !== null && view.inquiryCopy !== null) {
    return (
      <CopyInquiryButton
        label={action.label}
        href={action.href}
        text={view.inquiryCopy}
        weight={action.weight}
        onCopied={(outcome) => onAction({ kind: "copied", what: "inquiry", outcome })}
      />
    );
  }
  return <ActionControl action={action} onAction={onAction} />;
}

function ViewCta({ view, onAction }: { readonly view: TrackingViewModel; readonly onAction: (action: ResultAction) => void }): React.JSX.Element {
  const headingId = useId();
  const next = view.nextAction;
  const actions = ctaActions(view);
  const all = [next.primary, ...next.secondary];
  const talkIsPrimary = actions.some((action) => action.kind === "talk" && action.weight === "primary");
  const storesLead = view.revenue.stores === "ctaLead";
  const undelivered = all.find((action) => action?.kind === "undeliveredHelp") ?? null;
  const undeliveredHelp = view.help.find((item) => item.id === "undelivered") ?? null;
  const showReturnLink = view.mode === "settled" || all.some((action) => action?.kind === "copyReturnLink");
  return (
    <section
      data-cta-state={view.ctaState}
      aria-labelledby={next.heading ? headingId : undefined}
      aria-label={next.heading ? undefined : UNLABELLED_BLOCK_NAME}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900"
    >
      {next.heading ? (
        <h3 id={headingId} className="break-keep text-base font-bold">
          {next.heading}
        </h3>
      ) : null}
      <p className="break-keep text-sm leading-6 text-slate-800">{next.sentence}</p>
      {storesLead && next.stores ? <StoreLinks stores={next.stores} /> : null}
      {actions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          {actions.map((action) => (
            <CtaAction key={`${action.kind}-${action.weight}`} action={action} view={view} onAction={onAction} />
          ))}
        </div>
      ) : null}
      {next.carrierChoices ? <CarrierChoices choices={next.carrierChoices} onAction={onAction} /> : null}
      {next.worry ? <WorryLine worry={next.worry} showTalk={!talkIsPrimary} /> : null}
      {next.note ? <p className="break-keep text-sm leading-6 text-slate-700">{next.note}</p> : null}
      {!storesLead && next.stores ? <StoreLinks stores={next.stores} /> : null}
      {undelivered && undeliveredHelp ? <UndeliveredHelp summary={undelivered.label} help={undeliveredHelp} /> : null}
      {showReturnLink ? <ReturnLinkButton key={view.returnLink} number={view.number.raw} carrier={view.carrier.code} /> : null}
    </section>
  );
}

export const CustomerCta = ({ view, onAction }: CustomerCtaProps) => <ViewCta view={view} onAction={onAction} />;
