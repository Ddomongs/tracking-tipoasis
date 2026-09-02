import { ArrowUpRight, PackageOpen } from "lucide-react";
import { AnimatedIcon } from "@/components/AnimatedIcon";
import { STOREFRONTS } from "@/lib/storefront";
import type { StorefrontTone } from "@/lib/storefront";
import { cn } from "@/lib/utils";

const visualByTone: Record<StorefrontTone, "store" | "shopping"> = {
  naver: "store",
  coupang: "shopping"
};

const surfaceByTone: Record<StorefrontTone, string> = {
  naver: "hover:border-emerald-300/55",
  coupang: "hover:border-amber-200/55"
};

const labelByTone: Record<StorefrontTone, string> = {
  naver: "text-emerald-300",
  coupang: "text-amber-200"
};

const externalRel = (isAffiliate: boolean): string =>
  isAffiliate ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer";

export const StorefrontShowcase = () => (
  <section
    id="storefront"
    data-storefront-showcase="true"
    aria-labelledby="storefront-title"
    className="scroll-mt-24 py-12 sm:py-20"
  >
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="section-kicker">스토어 바로가기</p>
        <h2 id="storefront-title" className="section-title mt-3 text-2xl sm:text-3xl">
          새로운 상품을 찾고 계신가요?
        </h2>
        <p className="section-copy mt-3 text-sm sm:text-base">
          스토어별 상품을 확인하세요.
        </p>
      </div>
      <p className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
        <PackageOpen className="h-4 w-4" aria-hidden="true" />
        상품 정보는 판매처 기준
      </p>
    </div>

    <div className="mt-6 grid gap-3 sm:mt-8 md:grid-cols-5 md:gap-4">
      {STOREFRONTS.map((storefront, index) => {
        const visual = visualByTone[storefront.id];
        return (
          <a
            key={storefront.id}
            href={storefront.href}
            target="_blank"
            rel={externalRel(storefront.isAffiliate)}
            aria-label={`${storefront.name} 상품 보기 새 창으로 열기`}
            className={cn(
              "brand-panel group flex min-h-48 flex-col justify-between p-5 transition duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80 active:translate-y-0 sm:min-h-52 sm:p-6",
              index === 0 ? "md:col-span-3" : "md:col-span-2",
              surfaceByTone[storefront.id]
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <span className={cn("font-mono text-xs font-semibold tabular-nums", labelByTone[storefront.id])}>
                0{index + 1}
              </span>
              <AnimatedIcon kind={visual} delay={index === 0 ? "short" : "long"} />
            </div>
            <div className="mt-8">
              <h3 className="text-xl font-semibold text-white sm:text-2xl">{storefront.name}</h3>
              <p className="mt-2 max-w-md break-keep text-sm leading-6 text-slate-300">{storefront.description}</p>
              <span className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-100">
                상품 보기
                <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
              </span>
            </div>
          </a>
        );
      })}
    </div>

    <p className="mt-5 max-w-3xl break-keep text-xs leading-5 text-slate-400">
      일부 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.
    </p>
  </section>
);
