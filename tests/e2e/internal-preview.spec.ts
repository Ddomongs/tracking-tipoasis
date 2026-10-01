import { expect, test, type Locator, type Page } from "@playwright/test";
import { deriveResultView } from "@/components/result/approvals";
import { siteConfig } from "@/config/site.config";
import { buildCsReply } from "@/lib/cs/cs-reply";
import { PREVIEW_NUMBERS, PREVIEW_SCENARIO_IDS, buildPreviewScenarios } from "@/lib/cs/preview-outcomes";
import { HBL_LIKE_PATTERN, findDisallowedDigitRuns } from "@/lib/privacy/number-patterns";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";
import { openDesk } from "../support/internal-desk";

test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

const panel = (page: Page): Locator => page.locator('[data-internal-tab="preview"]');
const scenarioSection = (page: Page, id: string): Locator => page.locator(`[data-preview-scenario="${id}"]`);

async function openPreview(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await openDesk(page, "preview");
  await expect(page.locator("[data-preview-scenario]")).toHaveCount(PREVIEW_SCENARIO_IDS.length);
}

test("every state shows the customer's screen and the replies built from the same view", async ({ page }) => {
  await openPreview(page);
  for (const scenario of buildPreviewScenarios(FIXTURE_NOW)) {
    const view = deriveResultView(scenario.outcome, FIXTURE_NOW);
    const reply = buildCsReply(view, { now: FIXTURE_NOW, notices: siteConfig.notices });
    const section = scenarioSection(page, scenario.id);
    await expect(section.getByRole("heading", { level: 2 }).first()).toHaveText(scenario.label);
    const frame = section.locator('[data-preview-frame="375"]');
    await expect(frame.locator("[data-result-view]")).toHaveAttribute("data-result-view", view.mode);
    if (scenario.outcome.kind === "failure") {
      await expect(frame.locator(`[data-failure-cause="${scenario.outcome.cause}"]`)).toHaveCount(1);
    } else {
      await expect(frame.locator(`[data-guide-key="${view.guideKey}"]`)).toHaveCount(1);
    }
    await expect(frame.getByRole("heading", { level: 2 }).first()).toHaveText(view.title);
    await expect(section.getByLabel("짧은 답변", { exact: true })).toHaveValue(reply.short);
    await expect(section.getByLabel("자세한 답변", { exact: true })).toHaveValue(reply.long);
  }
  await expect(scenarioSection(page, "customsWaitingOverdue").locator('[data-overdue="true"]')).toHaveCount(1);
});

test("only fake numbers appear: no other 10+ digit run, and TEST 0000 0001 is the only HBL-like token", async ({ page }) => {
  await openPreview(page);
  const text = await panel(page).innerText();
  const replies = (
    await panel(page)
      .locator("textarea")
      .evaluateAll((areas) => areas.map((area) => (area instanceof HTMLTextAreaElement ? area.value : "")))
  ).join("\n");
  expect(findDisallowedDigitRuns(text)).toEqual([]);
  expect(findDisallowedDigitRuns(replies)).toEqual([]);
  expect(new Set(`${text}\n${replies}`.match(HBL_LIKE_PATTERN) ?? [])).toEqual(new Set([PREVIEW_NUMBERS.hbl]));
});

test("the preview is read-only: nothing takes focus and a link opens nothing", async ({ page }) => {
  await openPreview(page);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY");
  await expect(panel(page).locator('[data-result-view]:not([data-read-only="true"])')).toHaveCount(0);
  const frame = scenarioSection(page, "customsWaiting").locator('[data-preview-frame="375"]');
  const url = page.url();
  const popup = page.context().waitForEvent("page", { timeout: 1000 }).then(
    () => true,
    () => false
  );
  await frame.locator("a[href]").first().click();
  expect(await popup).toBe(false);
  expect(page.url()).toBe(url);
});

test("the customer screens are 375 px wide at desktop widths", async ({ page }) => {
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openPreview(page);
    const widths = await panel(page)
      .locator('[data-preview-frame="375"]')
      .evaluateAll((frames) => frames.map((frame) => Math.round(frame.getBoundingClientRect().width)));
    expect(widths).toHaveLength(PREVIEW_SCENARIO_IDS.length);
    expect(new Set(widths)).toEqual(new Set([375]));
  }
});
