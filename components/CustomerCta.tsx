"use client";

import { ExternalLink, MessageCircle, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const STORE_URL = "https://smartstore.naver.com/ddomongs";
const TALK_URL = "https://talk.naver.com/ct/w41rsr";

type CustomerCtaProps = {
  variant?: "inline" | "mobileFixed";
};

const ctaLinks = [
  {
    label: "스토어 바로가기",
    shortLabel: "스토어",
    href: STORE_URL,
    icon: Store,
    className:
      "border-slate-600/80 bg-slate-900/70 text-slate-100 hover:border-emerald-300/50 hover:bg-slate-800/90"
  },
  {
    label: "톡톡 문의",
    shortLabel: "톡톡 문의",
    href: TALK_URL,
    icon: MessageCircle,
    className:
      "border-[#03c75a]/70 bg-[#03c75a] text-slate-950 shadow-[0_10px_24px_rgba(3,199,90,0.28)] hover:bg-[#18d86d]"
  }
] as const;

export const CustomerCta = ({ variant = "inline" }: CustomerCtaProps) => {
  const isMobileFixed = variant === "mobileFixed";

  return (
    <nav
      aria-label="고객지원 바로가기"
      className={cn(
        "pointer-events-auto",
        isMobileFixed
          ? "fixed inset-x-0 bottom-0 z-50 border-t border-slate-700/70 bg-slate-950/90 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-12px_35px_rgba(2,6,23,0.55)] backdrop-blur-xl lg:hidden"
          : "rounded-2xl border border-emerald-300/20 bg-slate-900/45 p-3"
      )}
    >
      {!isMobileFixed ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-100">고객지원</p>
            <p className="mt-1 text-xs text-slate-400">상품 확인이나 문의가 필요할 때 바로 이동하세요.</p>
          </div>
        </div>
      ) : null}

      <div className={cn("grid grid-cols-2 gap-2", !isMobileFixed && "sm:max-w-md")}>
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
                "inline-flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/80",
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
