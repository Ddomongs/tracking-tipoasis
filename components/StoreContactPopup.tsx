"use client";

import { useState } from "react";
import { ExternalLink, Headphones, MessageCircle, ShoppingBag, Store, X } from "lucide-react";
import { COUPANG_STORE_URL, NAVER_STORE_URL, TALK_URL } from "@/lib/storefront";

type StoreContactPopupProps = {
  readonly visible: boolean;
};

export const StoreContactPopup = ({ visible }: StoreContactPopupProps) => {
  const [open, setOpen] = useState(true);

  if (!visible) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="contact-popup-position fixed right-4 z-50 inline-flex min-h-12 items-center gap-2 rounded-full border border-cyan-200/30 bg-slate-950/95 px-4 text-sm font-semibold text-cyan-50 shadow-[0_18px_45px_rgba(2,8,23,0.62)] backdrop-blur-xl transition hover:border-cyan-200/60 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
        aria-label="상담과 스토어 바로가기 다시 열기"
      >
        <Headphones className="h-4 w-4" aria-hidden="true" />
        상담·스토어
      </button>
    );
  }

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="store-contact-title"
      data-contact-popup="true"
      className="contact-popup-position fixed inset-x-3 z-50 mx-auto max-w-md overflow-hidden rounded-[1.25rem] border border-cyan-200/25 bg-slate-950/95 p-3 shadow-[0_24px_70px_rgba(2,8,23,0.72)] backdrop-blur-xl sm:inset-x-auto sm:right-5 sm:mx-0 sm:w-[25rem] sm:rounded-[1.4rem] sm:p-5"
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-cyan-300/15 blur-3xl" aria-hidden="true" />
      <div className="relative flex items-start gap-3">
        <span className="brand-icon-tile h-10 w-10 shrink-0 sm:h-11 sm:w-11">
          <Headphones className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="section-kicker hidden sm:block">빠른 상담 · 스토어</p>
          <h2 id="store-contact-title" className="break-keep text-[15px] font-semibold leading-snug text-white sm:mt-1 sm:text-lg">
            <span className="sm:hidden">상담·스토어 바로가기</span>
            <span className="hidden sm:inline">문의와 상품 확인을 바로 시작하세요</span>
          </h2>
          <p className="mt-1 hidden break-keep text-xs leading-5 text-slate-300 sm:block">
            배송조회는 그대로 이용하고, 필요한 곳만 새 창으로 열 수 있어요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80 sm:h-11 sm:w-11"
          aria-label="상담과 스토어 팝업 닫기"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="relative mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:grid-cols-2">
        <a
          href={TALK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 px-2 text-[11px] font-bold text-slate-950 shadow-[0_10px_25px_rgba(45,212,191,0.25)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 sm:col-span-2 sm:gap-2 sm:px-4 sm:text-sm"
          aria-label="상담사에게 톡톡 문의하기 새 창으로 열기"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          <span className="sm:hidden">상담사</span>
          <span className="hidden sm:inline">상담사에게 바로 문의</span>
          <ExternalLink className="hidden h-3.5 w-3.5 sm:block" aria-hidden="true" />
        </a>
        <a
          href={NAVER_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="store-quick-link px-2 text-[11px] sm:px-3 sm:text-sm"
          aria-label="네이버 스토어 바로가기 새 창으로 열기"
        >
          <Store className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          <span className="sm:hidden">네이버</span>
          <span className="hidden sm:inline">네이버 스토어</span>
        </a>
        <a
          href={COUPANG_STORE_URL}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          className="store-quick-link px-2 text-[11px] sm:px-3 sm:text-sm"
          aria-label="쿠팡 스토어 바로가기 새 창으로 열기"
        >
          <ShoppingBag className="h-4 w-4 text-amber-200" aria-hidden="true" />
          <span className="sm:hidden">쿠팡</span>
          <span className="hidden sm:inline">쿠팡 스토어</span>
        </a>
      </div>
    </aside>
  );
};
