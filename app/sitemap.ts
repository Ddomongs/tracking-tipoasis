import type { MetadataRoute } from "next";
import { GUIDE_SLUGS } from "@/lib/guides/guides";
import { SITE_ORIGIN } from "@/lib/site";

/** Public, indexable pages only (spec §3) plus the guides (10월 2일 요청 ②). Number routes are never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_ORIGIN}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_ORIGIN}/guide`, changeFrequency: "monthly", priority: 0.7 },
    ...GUIDE_SLUGS.map((slug) => ({ url: `${SITE_ORIGIN}/guide/${slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    { url: `${SITE_ORIGIN}/privacy`, changeFrequency: "yearly", priority: 0.3 }
  ];
}
