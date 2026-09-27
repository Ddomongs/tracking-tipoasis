import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { STYLE_IDS, STYLE_STORAGE_KEY, type StyleId } from "@/lib/style/styles";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, FIXTURE_NOW, mockTrack, trackData, type FailureFixture } from "../fixtures/tracking-fixtures";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1280, height: 900 }
] as const;

interface Scene {
  readonly name: string;
  readonly path: string;
  readonly reply: TrackResponseData | FailureFixture | null;
  readonly ready: string;
}

const SCENES: readonly Scene[] = [
  { name: "home", path: "/", reply: null, ready: '[data-view-state="idle"]' },
  { name: "pending", path: `/${FAKE.domestic}`, reply: trackData("pending", { trackingNumber: FAKE.domestic }), ready: '[data-result-view="settled"]' },
  { name: "delivered", path: `/${FAKE.domestic}`, reply: trackData("delivered", { trackingNumber: FAKE.domestic }), ready: '[data-result-view="settled"]' },
  { name: "notFound", path: `/${FAKE.domestic}`, reply: "notFound404", ready: '[data-result-view="error"]' }
];

async function useStyle(page: Page, style: StyleId): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [STYLE_STORAGE_KEY, style] as const
  );
}

async function violations(page: Page): Promise<readonly string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

test.describe("axe per style (S08, approval 13)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
    await page.clock.setFixedTime(FIXTURE_NOW);
  });

  for (const style of STYLE_IDS) {
    for (const viewport of VIEWPORTS) {
      test(`${style} · ${viewport.width}: home, results and the error screen have no WCAG 2.2 AA violation`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await useStyle(page, style);
        for (const scene of SCENES) {
          if (scene.reply !== null) await mockTrack(page, scene.reply);
          await page.goto(scene.path);
          await expect(page.locator(scene.ready)).toBeVisible();
          await expect(page.locator("html")).toHaveAttribute("data-style", style);
          await page.waitForLoadState("networkidle");
          expect(await violations(page), `${style} ${viewport.width} ${scene.name}`).toEqual([]);
        }
      });
    }

    test.describe(`${style}: the gallery`, () => {
      test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

      test(`${style}: every primitive in the gallery has no WCAG 2.2 AA violation`, async ({ page }) => {
        await useStyle(page, style);
        await page.goto("/internal/ui-kit");
        await expect(page.locator("main[data-ui-kit]")).toBeVisible();
        const results = await new AxeBuilder({ page }).include("main[data-ui-kit]").withTags(WCAG_TAGS).analyze();
        expect(results.violations.map((violation) => violation.id)).toEqual([]);
      });
    });
  }
});
