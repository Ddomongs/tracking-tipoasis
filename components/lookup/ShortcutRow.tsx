import { channels, disclosures } from "@/config/site.config";
import { FailureFallback } from "@/components/lookup/FailureFallback";
import { buttonClassName } from "@/components/primitives/Button";

export const SHORTCUT_REGION_LABEL = "상담·스토어 바로가기";
const NEW_WINDOW_SUFFIX = " 새 창으로 열기";
/** The button slot's secondary look (44 px outline), with the tighter padding three links need in one row at 360 px. */
const LINK_CLASS = buttonClassName("secondary", "md", "!px-1 !text-tt-sm");

function TalkBubbleIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className="shrink-0"
    >
      <path d="M4 5h16v11H10l-6 4z" />
    </svg>
  );
}

function ShortcutLink({
  href,
  label,
  sponsored,
  icon
}: {
  readonly href: string;
  readonly label: string;
  readonly sponsored: boolean;
  readonly icon: React.ReactNode;
}): React.JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel={sponsored ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer"}
      aria-label={`${label}${NEW_WINDOW_SUFFIX}`}
      data-slot="button"
      data-variant="secondary"
      data-size="md"
      data-link-placement="shortcut"
      className={LINK_CLASS}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

/**
 * Region '상담·스토어 바로가기' right under [조회하기] (spec §4, approval 1): the definitive disclosure first, then
 * [톡톡 상담][네이버 스토어][쿠팡 스토어] as 44 px outlines, lighter than the one filled button. `isAffiliate` alone decides
 * the disclosure and rel="sponsored nofollow" (spec §8). While the number is invalid only 톡톡 stays — as the error CTA
 * block, so the screen keeps one 톡톡 place besides the header and the footer (spec §8 "화면당 최대 3곳").
 */
export function ShortcutRow({ mode }: { readonly mode: "full" | "talkOnly" }): React.JSX.Element {
  if (mode === "talkOnly") {
    return (
      <section aria-label={SHORTCUT_REGION_LABEL} data-shortcut-row="talkOnly">
        <FailureFallback guideKey="invalidNumber" />
      </section>
    );
  }
  const stores = [channels.naver, channels.coupang];
  const hasAffiliate = stores.some((store) => store.isAffiliate);
  return (
    <section aria-label={SHORTCUT_REGION_LABEL} data-shortcut-row="full" className="flex flex-col gap-2 px-[var(--tt-gutter)]">
      {hasAffiliate ? <p data-affiliate-disclosure="coupang">{disclosures.coupang}</p> : null}
      <div className="grid grid-cols-3 gap-2">
        <ShortcutLink href={channels.talk.url} label={channels.talk.labels.shortcut} sponsored={false} icon={<TalkBubbleIcon />} />
        {stores.map((store) => (
          <ShortcutLink key={store.name} href={store.urls.shortcut} label={store.name} sponsored={store.isAffiliate} icon={null} />
        ))}
      </div>
    </section>
  );
}
