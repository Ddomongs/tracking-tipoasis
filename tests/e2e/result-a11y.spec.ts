import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { TrackResponseData } from "@/lib/types";
import { OCTOBER_NOW, customsWaitingData, inTransitData } from "../fixtures/derive-scenarios";
import { FAKE, FIXTURE_NOW, mockTrack, trackData, type FailureFixture } from "../fixtures/tracking-fixtures";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const OVERDUE_NOW = new Date("2026-09-29T09:00:00+09:00");

interface A11yScene {
  readonly name: string;
  readonly reply: TrackResponseData | FailureFixture;
  readonly now: Date;
  readonly delayMs?: number;
  readonly ready: string;
}

const SCENES: readonly A11yScene[] = [
  { name: "loading", reply: trackData("customsWaiting"), now: FIXTURE_NOW, delayMs: 20_000, ready: "[data-loading-stage]" },
  { name: "pending", reply: trackData("pending"), now: FIXTURE_NOW, ready: "[data-result-view]" },
  { name: "customsWaiting", reply: trackData("customsWaiting"), now: FIXTURE_NOW, ready: "[data-result-view]" },
  { name: "inTransit", reply: inTransitData(), now: OCTOBER_NOW, ready: "[data-result-view]" },
  { name: "delivered", reply: trackData("delivered"), now: FIXTURE_NOW, ready: "[data-result-view]" },
  { name: "overdue", reply: customsWaitingData(), now: OVERDUE_NOW, ready: "[data-result-view]" },
  { name: "stale", reply: trackData("stale"), now: FIXTURE_NOW, ready: "[data-result-view]" },
  { name: "ambiguous", reply: trackData("ambiguous"), now: FIXTURE_NOW, ready: "[data-result-view]" },
  { name: "notFound", reply: "notFound404", now: FIXTURE_NOW, ready: "[data-result-view]" },
  { name: "serverError", reply: "serverError500", now: FIXTURE_NOW, ready: "[data-result-view]" }
];

async function blockOtherHosts(page: Page): Promise<void> {
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

async function open(page: Page, scene: A11yScene): Promise<void> {
  await page.clock.setFixedTime(scene.now);
  await mockTrack(page, scene.reply, { delayMs: scene.delayMs });
  await page.goto(`/${typeof scene.reply === "string" ? FAKE.domestic : scene.reply.trackingNumber}`);
  await expect(page.locator(scene.ready)).toBeVisible();
  // The status field paints once (tt-paint, 200 ms) from the ground colour; measure contrast on the final colours.
  // Only time-based ones: the phone bottom bar follows the scroll (10월 2일 요청) and never "finishes" on its own.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.timeline === document.timeline)
        .map((animation) => animation.finished.catch(() => undefined))
    )
  );
}

/** Violations as 'scene: rule — targets'. */
async function violationsOf(page: Page, label: string): Promise<readonly string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return results.violations.map((violation) => `${label}: ${violation.id} — ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

test.describe("result area accessibility (S07, approval 13)", () => {
  test.describe.configure({ timeout: 150_000 });

  for (const [width, height] of [
    [375, 812],
    [1280, 900]
  ] as const) {
    test(`no WCAG 2.2 AA violations in the loading card and the key result rows at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await blockOtherHosts(page);
      const found: string[] = [];
      for (const scene of SCENES) {
        await open(page, scene);
        found.push(...(await violationsOf(page, scene.name)));
      }
      expect(found).toEqual([]);
    });
  }

  test("opened history and 미수령 안내 stay clean at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await blockOtherHosts(page);
    await open(page, { name: "delivered", reply: trackData("delivered"), now: FIXTURE_NOW, ready: "[data-result-view]" });
    await page.locator("details[data-history] summary").click();
    await page.locator('[data-cta-state="delivered"]').getByRole("button", { name: "수령이 안 됐다면 여기를 눌러 주세요" }).click();
    await expect(page.locator("details[data-delivered-help]")).toHaveAttribute("open", "");
    expect(await violationsOf(page, "delivered, details open")).toEqual([]);
  });
});
