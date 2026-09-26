import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

/**
 * Real robots.txt (spec §3). Number routes stay crawlable on purpose: they answer X-Robots-Tag: noindex,
 * and a Disallow would hide that header from crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/internal/"] },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`
  };
}
