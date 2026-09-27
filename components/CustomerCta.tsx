"use client";

import { useId } from "react";
import { ExternalLink, MessageCircle, ShoppingBag, Store } from "lucide-react";
import { ReturnLinkButton } from "@/components/ReturnLinkButton";
import { CopyInquiryButton } from "@/components/status-slot/CopyInquiryButton";
import { ActionControl, RECOVERY_KINDS, actionClassName } from "@/components/status-slot/SlotParts";
import { WorryLine } from "@/components/status-slot/WorryLine";
import { COUPANG_STORE_URL, NAVER_STORE_URL, TALK_URL } from "@/lib/storefront";
import type { ActionView, CarrierChoiceView, HelpItemView, ResultAction, StoreLinksView, TrackingViewModel } from "@/lib/tracking/types";
import { cn } from "@/lib/utils";

export type CustomerCtaState = "idle" | "error" | "pending" | "inTransit" | "delivered";
export type ResultCustomerCtaState = Exclude<CustomerCtaState, "idle">;

/** Only the unused floating variant is left for S06 to delete; results use variant "view". */
type LegacyCtaProps = {
  readonly variant: "floating";
  readonly state: "idle";
};

type CustomerCtaProps =
  | LegacyCtaProps
  | {
      readonly variant: "view";
      readonly view: TrackingViewModel;
      readonly onAction: (action: ResultAction) => void;
    };

const linkByKey = {
  naver: {
    label: "네이버 스토어 보기",
    href: NAVER_STORE_URL,
    icon: Store,
    className:
      "border-[#03c75a]/55 bg-slate-900/75 text-slate-100 hover:border-[#03c75a]/90 hover:bg-[#03c75a]/15"
  },
  coupang: {
    label: "쿠팡 스토어 보기",
    href: COUPANG_STORE_URL,
    icon: ShoppingBag,
    className:
      "border-amber-300/55 bg-amber-300/10 text-amber-50 hover:border-amber-200/90 hover:bg-amber-300/20"
  },
  talk: {
    label: "톡톡으로 문의하기",
    href: TALK_URL,
    icon: MessageCircle,
    className:
      "border-[#03c75a]/70 bg-[#03c75a] text-slate-950 shadow-[0_10px_24px_rgba(3,199,90,0.24)] hover:bg-emerald-400"
  }
} as const;

type CtaLinkKey = keyof typeof linkByKey;

type CtaContent = {
  readonly title: string;
  readonly description: string;
  readonly links: readonly CtaLinkKey[];
};

const contentByState: Record<CustomerCtaState, CtaContent> = {
  idle: {
    title: "문의가 필요하신가요?",
    description: "주문·상품 문의는 톡톡으로 남겨 주세요.",
    links: ["talk"]
  },
  error: {
    title: "조회가 잘되지 않나요?",
    description: "조회번호를 다시 확인하거나 톡톡으로 문의하세요.",
    links: ["talk"]
  },
  pending: {
    title: "아직 국내 배송 정보가 없어요",
    description: "구매한 쇼핑몰을 선택하거나 톡톡으로 문의하세요.",
    links: ["talk", "naver", "coupang"]
  },
  inTransit: {
    title: "배송이 진행 중이에요",
    description: "위 배송 내역에서 위치를 확인하세요.",
    links: ["talk"]
  },
  delivered: {
    title: "배송이 완료됐어요",
    description: "재구매나 다른 상품이 필요하면 스토어를 둘러보세요.",
    links: ["naver", "coupang", "talk"]
  }
};

const borderByState: Record<CustomerCtaState, string> = {
  idle: "border-emerald-300/30",
  error: "border-rose-300/35",
  pending: "border-amber-300/35",
  inTransit: "border-cyan-300/30",
  delivered: "border-emerald-300/35"
};

// The render type stays wide so Task 6 can drop the public "result" variant without touching this body.
const LegacyCta = ({ variant, state }: { readonly variant: LegacyCtaProps["variant"]; readonly state: CustomerCtaState }) => {
  const isFloating = variant === "floating";
  const content = contentByState[state];
  const hasAffiliateLink = content.links.includes("coupang");

  return (
    <nav
      aria-label="배송 및 기타 문의"
      data-cta-state={state}
      data-cta-variant={variant}
      className={cn(
        "pointer-events-auto rounded-2xl border bg-slate-950/95 shadow-[0_18px_45px_rgba(2,6,23,0.5)] backdrop-blur-xl",
        isFloating
          ? "mt-4 p-3 sm:ml-auto sm:w-80"
          : "p-4 sm:p-5",
        borderByState[state]
      )}
    >
      <div className={cn("space-y-1", !isFloating && "max-w-3xl")}>
        <p className="text-xs font-semibold text-emerald-200">배송 및 기타 문의</p>
        <h2 className={cn("font-semibold text-slate-50", isFloating ? "text-base" : "text-lg sm:text-xl")}>{content.title}</h2>
        <p className="break-keep text-sm leading-6 text-slate-300">{content.description}</p>
      </div>

      <div
        className={cn(
          "mt-3 grid gap-2",
          content.links.length === 3 ? "sm:grid-cols-3" : "sm:max-w-md",
          isFloating && "grid-cols-1"
        )}
      >
        {content.links.map((key) => {
          const link = linkByKey[key];
          const Icon = link.icon;
          const isDeliveredTalk = state === "delivered" && key === "talk";

          return (
            <a
              key={key}
              href={link.href}
              target="_blank"
              rel={key === "coupang" ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer"}
              aria-label={`${link.label} 새 창으로 열기`}
              className={cn(
                "inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/80",
                link.className,
                isDeliveredTalk && "border-slate-600 bg-slate-900/80 text-slate-200 shadow-none hover:border-slate-500 hover:bg-slate-800"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{link.label}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
            </a>
          );
        })}
      </div>
      {hasAffiliateLink ? (
        <p className="mt-3 break-keep text-xs leading-5 text-slate-300">
          쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.
        </p>
      ) : null}
    </nav>
  );
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

export const CustomerCta = (props: CustomerCtaProps) =>
  props.variant === "view" ? <ViewCta view={props.view} onAction={props.onAction} /> : <LegacyCta {...props} />;
