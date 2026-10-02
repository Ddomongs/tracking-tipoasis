import { AffiliateLinkGroup } from "@/components/primitives/AffiliateLinkGroup";
import { ButtonLink } from "@/components/primitives/ButtonLink";
import { STORE_SHEET_ID } from "@/components/supplementary/store-sheet";
import { channels, disclosures, resultCopy } from "@/config/site.config";
import type { StoreChannelId } from "@/lib/config/types";
import type { StoreLinksView } from "@/lib/tracking/types";

const TITLE_ID = "store-showcase-title";
const STORE_ORDER: readonly StoreChannelId[] = ["naver", "coupang"];
const INTRO = "베스트 상품과 특가는 스토어에서 바로 볼 수 있어요.";
const CLOSE_LABEL = "닫기";

function showcaseLinks(): StoreLinksView {
  const links = STORE_ORDER.map((id) => {
    const store = channels[id];
    return { channel: id, label: store.linkLabel, href: store.urls.showcase, isAffiliate: store.isAffiliate, weight: "secondary" as const };
  });
  return {
    placement: "showcase",
    intro: INTRO,
    disclosure: links.some((link) => link.isAffiliate) ? disclosures.coupang : null,
    links
  };
}

/**
 * Home only (spec §4 "첫 화면 아래", §7 idle; 10월 2일 요청으로 자리 이동): the two stores behind the definitive disclosure,
 * and the operator's YouTube channel once configured. One element serves both layouts (app/globals.css): a native
 * popover sheet opened by '스토어·추천 상품 보기' on narrow screens, a fixed panel right of the column from 1200 px.
 * A server component that TrackingPage passes as an idle extra, so it never shows in loading, result or error modes.
 */
export function StoreShowcase(): React.JSX.Element {
  const youtube = channels.youtube;
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
          {resultCopy.showcaseTitle}
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
      <AffiliateLinkGroup stores={showcaseLinks()} layout="row" />
      {youtube.url === null ? null : (
        <div data-youtube-channel="true">
          <ButtonLink href={youtube.url} variant="secondary" external label={youtube.linkLabel} />
        </div>
      )}
    </section>
  );
}
