import { disclosures } from "@/config/site.config";
import type { StoreLinksView } from "@/lib/tracking/types";
import { ButtonLink } from "./ButtonLink";

/**
 * Store/affiliate link block (spec §8). `isAffiliate` alone decides both the disclosure and rel:
 * when any link is affiliate the definitive disclosure is the FIRST child (from the view, or the configured
 * wording if the view left it out); with no affiliate link there is no disclosure even if the view carries one.
 * Affiliate links get rel "sponsored nofollow noopener noreferrer"; every link opens a new tab.
 */
export function AffiliateLinkGroup({
  stores,
  layout = "row"
}: {
  readonly stores: StoreLinksView;
  readonly layout?: "row" | "stack";
}): React.JSX.Element | null {
  if (stores.links.length === 0) return null;
  const hasAffiliate = stores.links.some((link) => link.isAffiliate);
  const disclosure = hasAffiliate ? (stores.disclosure ?? disclosures.coupang) : null;
  return (
    <div data-affiliate-group={stores.placement} className="flex min-w-0 flex-col gap-2">
      {disclosure === null ? null : <p data-affiliate-disclosure="coupang" data-slot="disclosure">{disclosure}</p>}
      {stores.intro === null ? null : <p className="m-0 text-tt-sm font-medium [word-break:keep-all]">{stores.intro}</p>}
      <div className={layout === "row" ? "grid grid-cols-1 gap-2 min-[360px]:grid-cols-2" : "flex flex-col items-start gap-2"}>
        {stores.links.map((link) => (
          <ButtonLink
            key={`${link.channel}-${link.href}`}
            href={link.href}
            variant={link.weight}
            external
            sponsored={link.isAffiliate}
            label={link.label}
            placement={stores.placement}
          />
        ))}
      </div>
    </div>
  );
}
