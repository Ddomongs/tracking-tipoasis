import { MessageCircle, PackageSearch } from "lucide-react";
import { TALK_URL } from "@/lib/storefront";

type SiteHeaderProps = {
  readonly showStorefront: boolean;
};

const anchorClassName =
  "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-300 transition-colors duration-200 hover:bg-slate-800/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80";

export const SiteHeader = ({ showStorefront }: SiteHeaderProps) => (
  <>
    <a
      href="#main-content"
      className="fixed left-4 top-3 z-50 -translate-y-20 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 shadow-xl transition-transform focus-visible:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
    >
      본문으로 건너뛰기
    </a>
    <header className="pointer-events-auto mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
    <a
      href="#tracking"
      className="inline-flex min-h-11 items-center gap-3 rounded-xl text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
      aria-label="통관 배송 조회로 이동"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
        <PackageSearch className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-sm font-semibold tracking-tight">통관·배송 안내</span>
        <span className="block text-xs text-slate-400">구매 고객 전용 조회</span>
      </span>
    </a>

    <nav aria-label="주요 메뉴" className="flex items-center gap-1">
      <a href="#tracking" className={anchorClassName}>
        배송 조회
      </a>
      <a href="#guide" className={`${anchorClassName} hidden sm:inline-flex`}>
        이용 안내
      </a>
      {showStorefront ? (
        <a href="#storefront" className={`${anchorClassName} hidden sm:inline-flex`}>
          스토어
        </a>
      ) : null}
      <a
        href={TALK_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="톡톡 문의 새 창으로 열기"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-300/10 px-3 text-sm font-semibold text-emerald-100 transition-colors duration-200 hover:bg-emerald-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/80"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">문의</span>
      </a>
    </nav>
    </header>
  </>
);
