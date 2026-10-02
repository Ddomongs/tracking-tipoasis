import { AffiliateLinkGroup } from "@/components/primitives/AffiliateLinkGroup";
import { ButtonLink } from "@/components/primitives/ButtonLink";
import { STORE_SHEET_ID } from "@/components/supplementary/store-sheet";
import { channels, disclosures } from "@/config/site.config";
import type { SiteSettings } from "@/lib/site-settings/settings";
import type { StoreLinksView } from "@/lib/tracking/types";

const TITLE_ID = "store-showcase-title";
const CLOSE_LABEL = "닫기";

function showcaseLinks(settings: SiteSettings): StoreLinksView {
  const links = [
    { channel: "naver" as const, label: settings.naverLabel, href: settings.naverUrl, isAffiliate: channels.naver.isAffiliate, weight: "secondary" as const },
    { channel: "coupang" as const, label: settings.coupangLabel, href: settings.coupangUrl, isAffiliate: channels.coupang.isAffiliate, weight: "secondary" as const }
  ];
  return {
    placement: "showcase",
    intro: settings.storeIntro,
    disclosure: links.some((link) => link.isAffiliate) ? disclosures.coupang : null,
    links
  };
}

/**
 * Home only (spec §4 "첫 화면 아래", §7 idle; 10월 2일 요청으로 자리 이동): the two stores behind the definitive disclosure,
 * and the operator's YouTube channel once configured. One element serves both layouts (app/globals.css): a native
 * popover sheet opened by '스토어·추천 상품 보기' on narrow screens, a fixed panel right of the column from 1260 px.
 * A server component that TrackingPage passes as an idle extra, so it never shows in loading, result or error modes.
 * Words and links come from the staff-edited site settings (lib/site-settings, defaults in config/site.config.ts).
 */
export function StoreShowcase({ settings }: { readonly settings: SiteSettings }): React.JSX.Element {
  return (
    <section
      id={STORE_SHEET_ID}
      popover="auto"
      data-store-showcase="true"
      aria-labelledby={TITLE_ID}
      className="flex-col gap-3 bg-tt-surface text-tt-ink"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={TITLE_ID} className="m-0 text-tt-lg font-bold [word-break:keep-all]">
          {settings.storeTitle}
        </h2>
        <button
          type="button"
          popoverTarget={STORE_SHEET_ID}
          popoverTargetAction="hide"
          data-store-sheet-close="true"
          className="tt-focus inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-tt-sm font-bold underline underline-offset-[4px]"
        >
          {CLOSE_LABEL}
        </button>
      </div>
      <AffiliateLinkGroup stores={showcaseLinks(settings)} layout="row" />
      {settings.youtubeUrl === "" ? null : (
        <div data-youtube-channel="true">
          <ButtonLink href={settings.youtubeUrl} variant="secondary" external label={settings.youtubeLabel} />
        </div>
      )}
    </section>
  );
}
