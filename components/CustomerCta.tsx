"use client";

import { ExternalLink, MessageCircle, ShoppingBag, Store } from "lucide-react";
import { COUPANG_STORE_URL, NAVER_STORE_URL, TALK_URL } from "@/lib/storefront";
import { cn } from "@/lib/utils";

export type CustomerCtaState = "idle" | "error" | "pending" | "inTransit" | "delivered";
export type ResultCustomerCtaState = Exclude<CustomerCtaState, "idle">;

type CustomerCtaProps =
  | {
      readonly variant: "floating";
      readonly state: "idle";
    }
  | {
      readonly variant: "result";
      readonly state: ResultCustomerCtaState;
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

export const CustomerCta = ({ variant, state }: CustomerCtaProps) => {
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
