import type { DeliveryCarrierCode } from "@/lib/types";

/** Production origin (spec §1). Metadata routes, the sitemap and return links use it. */
export const SITE_ORIGIN = "https://tracking.tipoasis.com";
/** AdSense publisher id digits: the only non-fixture 10+ digit run the repository guard allows (roadmap §11.4). */
export const ADSENSE_PUBLISHER_DIGITS = "7351210358018620";
export const ADSENSE_CLIENT_ID = `ca-pub-${ADSENSE_PUBLISHER_DIGITS}`;
export const ADSENSE_LOADER_URL = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;

/** `${SITE_ORIGIN}/${encodeURIComponent(number)}` plus `?c=${carrier}` when carrier !== "AUTO". `number` is already normalized. */
export function buildReturnLink(number: string, carrier: DeliveryCarrierCode): string {
  const link = `${SITE_ORIGIN}/${encodeURIComponent(number)}`;
  return carrier === "AUTO" ? link : `${link}?c=${carrier}`;
}
