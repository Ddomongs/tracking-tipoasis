import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

/** Public, indexable pages only (spec §3). Number routes are never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_ORIGIN}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_ORIGIN}/privacy`, changeFrequency: "yearly", priority: 0.3 }
  ];
}
