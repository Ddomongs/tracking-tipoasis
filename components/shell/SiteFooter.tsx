import Link from "next/link";
import { TalkLink } from "@/components/primitives/TalkLink";
import { channels, resultCopy } from "@/config/site.config";

/** Existing E2E wording: tests/privacy.spec.ts reaches the policy through the footer link with this name. */
const PRIVACY_LINK_LABEL = "개인정보처리방침";

/**
 * Public footer (spec §8 문의, §14 "app/(public)/layout.tsx: 헤더, 푸터"): where the data comes from, the privacy policy,
 * and the third of at most three 톡톡 places on a screen (header, one state place, footer).
 */
export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="border-t border-tt-rule bg-tt-surface text-tt-ink">
      <div className="mx-auto flex w-full max-w-[var(--tt-column)] flex-col gap-2 px-[var(--tt-gutter)] py-6">
        <p className="m-0 text-tt-xs text-tt-muted [word-break:keep-all]">{resultCopy.footerNote}</p>
        <div className="flex flex-wrap items-center gap-x-6">
          <Link
            href="/privacy"
            className="tt-focus inline-flex min-h-[44px] items-center text-tt-sm font-bold text-tt-link underline decoration-2 underline-offset-[5px]"
          >
            {PRIVACY_LINK_LABEL}
          </Link>
          <TalkLink href={channels.talk.url} label={channels.talk.labels.footer} weight="text" placement="footer" />
        </div>
      </div>
    </footer>
  );
}
