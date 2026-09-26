import Link from "next/link";

/** Real 404 (spec §3, SEO-01). Rendered in the root layout only: no ads. S06 restyles it with the design tokens. */
export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto flex min-h-[70dvh] w-full max-w-xl flex-col justify-center px-4 py-16">
      <h1 className="break-keep text-2xl font-semibold text-slate-50">페이지를 찾을 수 없어요</h1>
      <p className="mt-3 break-keep text-sm leading-6 text-slate-300">
        주소가 바뀌었거나 잘못 입력된 것 같아요. 조회번호는 배송 조회 화면에서 다시 입력해 주세요.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center self-start rounded-xl border border-slate-600 px-4 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
      >
        배송 조회로 돌아가기
      </Link>
    </main>
  );
}
