"use client";

import { ExternalLink, MessageCircle, ShoppingBag, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const NAVER_STORE_URL = "https://mkt.shopping.naver.com/link/6a0bbf9cc55d142f0519328c";
const COUPANG_STORE_URL = "https://link.coupang.com/a/d7TbzdnS1s";
const TALK_URL = "https://talk.naver.com/ct/w41rsr";

type CustomerCtaProps = {
  variant?: "inline" | "result" | "mobileFixed";
};

const ctaLinks = [
  {
    label: "네이버 스토어",
    shortLabel: "네이버",
    href: NAVER_STORE_URL,
    icon: Store,
    className:
      "border-[#03c75a]/45 bg-slate-900/75 text-slate-100 hover:border-[#03c75a]/80 hover:bg-[#03c75a]/12"
  },
  {
    label: "쿠팡 스토어",
    shortLabel: "쿠팡",
    href: COUPANG_STORE_URL,
    icon: ShoppingBag,
    className:
      "border-amber-300/45 bg-amber-300/12 text-amber-50 hover:border-amber-200/80 hover:bg-amber-300/18"
  },
  {
    label: "톡톡 문의",
    shortLabel: "문의",
    href: TALK_URL,
    icon: MessageCircle,
    className:
      "border-[#03c75a]/70 bg-[#03c75a] text-slate-950 shadow-[0_10px_24px_rgba(3,199,90,0.28)] hover:bg-[#18d86d]"
  }
] as const;

export const CustomerCta = ({ variant = "inline" }: CustomerCtaProps) => {
  const isMobileFixed = variant === "mobileFixed";
  const isResult = variant === "result";

  return (
    <nav
      aria-label="고객지원 바로가기"
      className={cn(
        "pointer-events-auto",
        isMobileFixed
          ? "fixed inset-x-0 bottom-0 z-50 border-t border-slate-700/70 bg-slate-950/90 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 shadow-[0_-12px_35px_rgba(2,6,23,0.55)] backdrop-blur-xl lg:hidden"
          : "rounded-2xl border border-emerald-300/20 bg-slate-900/45 p-3",
        isResult && "border-cyan-300/25 bg-slate-900/55"
      )}
    >
      {!isMobileFixed ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-100">
              {isResult ? "쇼핑/문의 바로가기" : "고객지원"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {isResult
                ? "조회 결과를 확인한 뒤 필요한 상품 확인이나 문의로 바로 이동하세요."
                : "상품 확인이나 문의가 필요할 때 바로 이동하세요."}
            </p>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "grid grid-cols-3 gap-2",
          !isMobileFixed && "sm:max-w-3xl",
          isResult && "sm:max-w-none"
        )}
      >
        {ctaLinks.map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${link.label} 새 창으로 열기`}
              className={cn(
                "inline-flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/80 sm:gap-2 sm:px-3 sm:text-sm",
                link.className
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{isMobileFixed ? link.shortLabel : link.label}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-75" aria-hidden="true" />
            </a>
          );
        })}
      </div>
    </nav>
  );
};
