import { channels, stateGuide } from "@/config/site.config";
import { TalkLink } from "@/components/primitives/TalkLink";

/**
 * Error CTA block (spec §7 INVALID; E2E rule "오류는 문의 우선·스토어 홍보 없음"): heading, one sentence, and
 * [톡톡으로 문의하기] as the block's first link, at secondary weight next to the page's one filled button.
 * Used on the INVALID form screen and when the result code cannot be loaded ("serverError").
 */
export function FailureFallback({ guideKey }: { readonly guideKey: "invalidNumber" | "serverError" }): React.JSX.Element {
  const row = stateGuide[guideKey];
  return (
    <div data-cta-state="error" className="flex flex-col gap-2 border-t border-tt-rule px-[var(--tt-gutter)] pt-4">
      {row.ctaHeading === null ? null : <h3 className="m-0 text-tt-md font-bold text-tt-ink">{row.ctaHeading}</h3>}
      <p className="m-0 text-tt-sm text-tt-ink [word-break:keep-all]">{row.nextAction}</p>
      <div>
        <TalkLink href={channels.talk.url} label={channels.talk.labels.cta} weight="secondary" placement="state" />
      </div>
    </div>
  );
}
