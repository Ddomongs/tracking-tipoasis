import Link from "next/link";

/**
 * Phone-only bar that slides up from the bottom once the page scrolls (10월 2일 요청). Script-free: a CSS scroll-driven
 * animation (app/globals.css data-bottom-bar, icons there too so the '/' HTML stays small); browsers without it, and
 * reduced motion, show it at once. Three ways around — a new lookup, the guides and back to the top. 톡톡 and store
 * links stay out: the screen already has its three 톡톡 places (header, state, footer) and store links follow each
 * state's rule.
 */
export function BottomBar(): React.JSX.Element {
  return (
    <nav data-bottom-bar="true" aria-label="바로 가기">
      <Link href="/" prefetch={false} data-icon="search" className="tt-focus">
        새로 조회
      </Link>
      <Link href="/guide" prefetch={false} data-icon="guide" className="tt-focus">
        통관 가이드
      </Link>
      <a href="#main-content" data-icon="top" className="tt-focus">맨 위로</a>
    </nav>
  );
}
