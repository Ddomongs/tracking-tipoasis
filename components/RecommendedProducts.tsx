"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CarFront,
  GalleryVerticalEnd,
  MessageSquareQuote,
  PanelsTopLeft,
  ShoppingBag,
  Telescope,
  X
} from "lucide-react";
import { FEATURED_PRODUCTS } from "@/lib/storefront";
import { AnimatedIcon } from "@/components/AnimatedIcon";
import type { FeaturedProduct } from "@/lib/storefront";
import type { StatusCode } from "@/lib/types";

type RecommendedProductsProps = {
  readonly statusCode: StatusCode;
  readonly isPending?: boolean;
};

const iconByCategory: Record<FeaturedProduct["category"], typeof CarFront> = {
  carplay: PanelsTopLeft,
  telescope: Telescope,
  automotive: CarFront,
  display: GalleryVerticalEnd
};

const recommendationByStage = {
  pending: "통관을 기다리는 동안 가볍게 둘러보세요.",
  inTransit: "배송 현황을 확인했다면 다음 주문도 살펴보세요.",
  delivered: "배송 완료 고객이 다시 찾는 상품을 모았습니다."
} as const;

export const RecommendedProducts = ({ statusCode, isPending }: RecommendedProductsProps) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const stage = isPending || statusCode <= 4 ? "pending" : statusCode === 7 ? "delivered" : "inTransit";

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href]');
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const closePopup = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <section data-recommended-products={stage} aria-label="금주의 베스트 리뷰 상품">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="금주의 베스트 리뷰 상품 간략히 보기"
        className="group flex min-h-20 w-full items-center gap-3 rounded-2xl border border-cyan-200/25 bg-[linear-gradient(110deg,rgba(8,47,73,0.72),rgba(15,23,42,0.86))] p-3 text-left shadow-[0_16px_40px_rgba(2,8,23,0.38)] transition hover:border-cyan-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80 sm:p-4"
      >
        <AnimatedIcon kind="sparkles" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-cyan-200">금주의 베스트 판매 상품</span>
            <span className="rounded-full border border-amber-200/25 bg-amber-200/10 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
              고객 리뷰 4개
            </span>
          </span>
          <span className="mt-1 block break-keep text-sm font-semibold text-white sm:text-base">{recommendationByStage[stage]}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-cyan-100 sm:text-sm">
          <span className="hidden sm:inline">간략히 보기</span>
          <ArrowUpRight data-motion-cue="weekly-best" className="motion-cue-diagonal h-4 w-4" aria-hidden="true" />
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-slate-950/78 backdrop-blur-sm"
            onClick={closePopup}
            aria-label="금주의 베스트 상품 팝업 닫기"
          />
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="weekly-best-title"
            className="relative z-10 max-h-[88dvh] w-full max-w-4xl overflow-y-auto rounded-t-[1.75rem] border border-slate-700/80 bg-[#07111f] shadow-[0_30px_100px_rgba(0,0,0,0.68)] sm:rounded-[1.75rem]"
          >
            <header className="sticky top-0 z-20 flex items-start gap-3 border-b border-slate-700/70 bg-[#07111f]/95 p-4 backdrop-blur-xl sm:p-6">
              <span className="brand-icon-tile shrink-0">
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="section-kicker">BEST REVIEW PICKS</p>
                <h2 id="weekly-best-title" className="section-title mt-1 text-xl sm:text-2xl">금주의 베스트 리뷰 상품</h2>
                <p className="mt-1 break-keep text-xs leading-5 text-slate-400 sm:text-sm">
                  고객 리뷰를 확인하고 원하는 상품의 판매처로 이동하세요.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={closePopup}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
                aria-label="금주의 베스트 상품 팝업 닫기"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6">
              {FEATURED_PRODUCTS.map((product) => {
                const Icon = iconByCategory[product.category];

                return (
                  <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/65">
                    <div className="flex gap-3 p-3 sm:p-4">
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-cyan-200/20 bg-[radial-gradient(circle_at_30%_20%,rgba(103,232,249,0.2),transparent_55%),linear-gradient(145deg,#10243a,#08121f)] text-cyan-100 sm:h-28 sm:w-28">
                        <Icon className="h-10 w-10" strokeWidth={1.5} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-slate-400">{product.storefront === "naver" ? "네이버 스토어" : "쿠팡 스토어"}</p>
                        <h3 className="mt-1 break-keep text-sm font-semibold leading-5 text-white sm:text-base">{product.name}</h3>
                        <p className="mt-2 flex flex-wrap items-baseline gap-1.5">
                          <span className="text-xs font-bold text-rose-300">{product.discountLabel}</span>
                          <span className="text-base font-bold text-slate-50">{product.priceLabel}</span>
                        </p>
                        <a
                          href={product.href}
                          target="_blank"
                          rel={product.isAffiliate ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer"}
                          className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg border border-cyan-200/25 bg-cyan-200/10 px-2.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-200/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
                          aria-label={`${product.name} 판매처에서 찾기 새 창으로 열기`}
                        >
                          판매처에서 찾기
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </div>
                    </div>
                    <div className="border-t border-slate-700/60 bg-slate-950/45 p-3 sm:p-4">
                      <div className="flex items-start gap-2">
                        <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
                        <p className="break-keep text-xs leading-5 text-slate-300 sm:text-sm">{product.review}</p>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">{product.reviewer} · {product.reviewDate}</p>
                    </div>
                  </article>
                );
              })}
            </div>

            <p className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs leading-5 text-slate-400 sm:px-6 sm:pb-6">
              개별 상품 링크가 연결되기 전에는 해당 스토어의 상품 목록으로 이동합니다. 쿠팡 링크를 통해 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.
            </p>
          </section>
        </div>
      ) : null}
    </section>
  );
};
