import { expect, test, type Page, type Response } from "@playwright/test";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";

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

// ---- S05: signal style fonts (spec §12 font budget, §13 "system gothic + 1 numeric subset file") ----
const FIRST_VIEW_FONT_BUDGET_BYTES = 100 * 1024;

interface FirstViewFonts {
  readonly preloadCount: number;
  readonly totalBytes: number;
  readonly families: readonly string[];
}

async function collectFirstViewFonts(page: Page, path: string): Promise<FirstViewFonts> {
  const fontResponses: Response[] = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "font") fontResponses.push(response);
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(path, { waitUntil: "networkidle" });
  const families = await page.evaluate(async () => {
    await document.fonts.ready;
    return Array.from(document.fonts, (font) => font.family);
  });
  const preloadCount = await page.locator('link[rel="preload"][as="font"]').count();
  let totalBytes = 0;
  for (const response of fontResponses) totalBytes += (await response.request().sizes()).responseBodySize;
  return { preloadCount, totalBytes, families };
}

test.describe("signal style fonts (S05)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");

  for (const route of [
    { name: "home", path: "/" },
    { name: "deep link", path: `/${FAKE.domestic}` }
  ] as const) {
    test(`${route.name}: one DM Mono preload, no IBM Plex, first-view fonts within 100 KB`, async ({ page }) => {
      await mockTrack(page, trackData("customsWaiting"));
      const fonts = await collectFirstViewFonts(page, route.path);
      // Printed so the stage gate (G8) can record the measured budget.
      console.info(`[font-budget] ${route.name}: ${fonts.totalBytes} B in the first view, ${fonts.preloadCount} preload(s)`);
      expect(fonts.preloadCount).toBe(1);
      expect(fonts.totalBytes).toBeLessThanOrEqual(FIRST_VIEW_FONT_BUDGET_BYTES);
      expect(fonts.families.some((family) => /DM[_ ]Mono/.test(family))).toBe(true);
      expect(fonts.families.filter((family) => /IBM[_ ]Plex|Space[_ ]Grotesk/.test(family))).toEqual([]);
    });
  }
});
