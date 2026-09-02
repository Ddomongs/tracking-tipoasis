import { ArrowUp, MessageCircle } from "lucide-react";
import { TALK_URL } from "@/lib/storefront";

export const SiteFooter = () => (
  <footer className="flex flex-col gap-6 py-10 sm:flex-row sm:items-end sm:justify-between">
    <div className="max-w-2xl">
      <p className="text-sm font-semibold text-slate-200">통관·배송 통합 조회</p>
      <p className="mt-2 break-keep text-xs leading-5 text-slate-400">
        입력한 번호로 통관·배송 정보를 조회합니다. 정보는 UNI-PASS와 택배사 반영 시점에 따라 차이가 날 수 있습니다.
      </p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={TALK_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="톡톡으로 문의하기 새 창으로 열기"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/80"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        톡톡 문의
      </a>
      <a
        href="#tracking"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
      >
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
        배송 조회로
      </a>
    </div>
  </footer>
);
