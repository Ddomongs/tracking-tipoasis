import { expect, test } from "@playwright/test";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";
import { FAKE } from "../fixtures/tracking-fixtures";

/** Spec §12: at most 2 preloaded font files. Phase 1 (PERF-01) measured 281 on production. */
const MAX_FONT_PRELOADS = 2;
/** React flight-data preload hints inside the HTML, e.g. :HL[\"/_next/static/media/x.woff2\",\"font\",…]. */
const RSC_FONT_HINT = /:HL\[\\?"([^"\\]+?\.woff2)\\?",\\?"font/g;

function tagFontUrls(html: string): string[] {
  return Array.from(html.matchAll(/<link\b[^>]*>/g), (match) => match[0])
    .filter((tag) => /\brel="preload"/.test(tag) && /\bas="font"/.test(tag))
    .map((tag) => /\bhref="([^"]+)"/.exec(tag)?.[1] ?? tag);
}

function linkHeaderFontUrls(header: string | undefined): string[] {
  if (!header) return [];
  return header
    .split(/,\s*(?=<)/)
    .filter((entry) => /rel="?preload"?/i.test(entry) && /as="?font"?/i.test(entry))
    .map((entry) => entry.slice(entry.indexOf("<") + 1, entry.indexOf(">")));
}

function rscFontHintUrls(html: string): string[] {
  return Array.from(html.matchAll(RSC_FONT_HINT), (match) => match[1] ?? "");
}

test.describe("font preload budget (S01)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");

  for (const route of [
    { name: "home", path: "/" },
    { name: "deep link", path: `/${FAKE.domestic}` }
  ] as const) {
    test(`${route.name}: at most ${MAX_FONT_PRELOADS} font files are preloaded`, async ({ request }) => {
      const response = await request.get(route.path);
      expect(response.status()).toBe(200);
      const html = await response.text();
      const tags = tagFontUrls(html);
      const header = linkHeaderFontUrls(response.headers()["link"]);
      const hints = rscFontHintUrls(html);
      const unique = new Set([...tags, ...header, ...hints]);
      // Printed so the stage gate (G8) can record the measured budget.
      console.info(
        `[font-preload] ${route.name}: ${unique.size} files (tags ${tags.length}, Link header ${header.length}, RSC hints ${hints.length})`
      );
      expect(unique.size).toBeLessThanOrEqual(MAX_FONT_PRELOADS);
    });
  }
});
