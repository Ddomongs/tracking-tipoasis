import { channels } from "@/config/site.config";
import { HomeLink } from "@/components/shell/HomeLink";
import { TalkLink } from "@/components/primitives/TalkLink";

const SITE_NAME = "통관·배송 조회";
const SKIP_LINK_LABEL = "본문으로 건너뛰기";

/**
 * Public header (spec §4, §7 idle; WCAG 3.2.6): 48 px, the site name on the left and the text link '문의' (톡톡, new tab)
 * on the right — the same place on every public page. No store links (spec §4 "헤더 스토어 링크" 삭제).
 * The skip link is the first focusable element and stays off-screen until it receives focus.
 * Sticky (10월 2일 요청): '문의' stays reachable while the customer scrolls; html scroll-padding-top keeps focus clear of it.
 */
export function SiteHeader(): React.JSX.Element {
  return (
    <>
      <a
        href="#main-content"
        className="tt-focus absolute left-2 top-2 z-50 -translate-y-24 bg-tt-primary px-4 py-3 text-tt-sm font-bold text-tt-on-primary no-underline focus:translate-y-0"
      >
        {SKIP_LINK_LABEL}
      </a>
      <header className="sticky top-0 z-40 h-[var(--tt-header-h)] border-b border-tt-rule bg-tt-surface text-tt-ink">
        <div className="mx-auto flex h-full w-full max-w-[var(--tt-column)] items-center justify-between gap-3 px-[var(--tt-gutter)]">
          <HomeLink
            className="tt-focus inline-flex min-h-[44px] items-center text-tt-md font-black tracking-[-0.01em] text-tt-ink no-underline [word-break:keep-all]"
          >
            {SITE_NAME}
          </HomeLink>
          <TalkLink href={channels.talk.url} label={channels.talk.labels.header} weight="text" placement="header" />
        </div>
      </header>
    </>
  );
}
