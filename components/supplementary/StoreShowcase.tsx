import { AffiliateLinkGroup } from "@/components/primitives/AffiliateLinkGroup";
import { channels, disclosures, resultCopy } from "@/config/site.config";
import type { StoreChannelId } from "@/lib/config/types";
import type { StoreLinksView } from "@/lib/tracking/types";

const TITLE_ID = "store-showcase-title";
const STORE_ORDER: readonly StoreChannelId[] = ["naver", "coupang"];

function showcaseLinks(): StoreLinksView {
  const links = STORE_ORDER.map((id) => {
    const store = channels[id];
    return { channel: id, label: store.linkLabel, href: store.urls.showcase, isAffiliate: store.isAffiliate, weight: "secondary" as const };
  });
  return {
    placement: "showcase",
    intro: null,
    disclosure: links.some((link) => link.isAffiliate) ? disclosures.coupang : null,
    links
  };
}

/**
 * Home only, below '보통 이렇게 걸려요' (spec §4 "첫 화면 아래", §7 idle): the two stores behind the definitive disclosure.
 * A server component that TrackingPage passes as an idle extra, so it never shows in loading, result or error modes.
 */
export function StoreShowcase(): React.JSX.Element {
  return (
    <section
      data-store-showcase="true"
      aria-labelledby={TITLE_ID}
      className="flex flex-col gap-3 border-t-2 border-tt-ink bg-tt-surface px-[var(--tt-gutter)] py-6 text-tt-ink"
    >
      <h2 id={TITLE_ID} className="m-0 text-tt-lg font-bold [word-break:keep-all]">
        {resultCopy.showcaseTitle}
      </h2>
      <AffiliateLinkGroup stores={showcaseLinks()} layout="row" />
    </section>
  );
}
