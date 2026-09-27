import Link from "next/link";
import { buttonClassName } from "@/components/primitives/Button";

/** Real 404 (spec §3, SEO-01): dotted, Hangul and 31+ character paths land here. Root layout only, so no ads. */
export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[70dvh] w-full max-w-[var(--tt-column)] flex-col justify-center gap-3 bg-tt-surface px-[var(--tt-gutter)] py-16 text-tt-ink"
    >
      <h1 className="m-0 text-tt-xl font-black [word-break:keep-all]">페이지를 찾을 수 없어요</h1>
      <p className="m-0 text-tt-sm [word-break:keep-all]">
        주소가 바뀌었거나 잘못 입력된 것 같아요. 조회번호는 배송 조회 화면에서 다시 입력해 주세요.
      </p>
      <Link href="/" className={buttonClassName("secondary", "md", "mt-3 self-start")}>
        배송 조회로 돌아가기
      </Link>
    </main>
  );
}
