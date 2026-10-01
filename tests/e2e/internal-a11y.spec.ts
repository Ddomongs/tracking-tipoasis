import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { INTERNAL_TAB_IDS } from "@/components/internal/tabs";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import { deliveredData } from "../fixtures/derive-scenarios";
import { FAKE, FIXTURE_NOW, mockTrack } from "../fixtures/tracking-fixtures";
import { openDesk } from "../support/internal-desk";

test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violationsIn(page: Page, selector: string): Promise<readonly string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_22_AA).include(selector).analyze();
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

for (const id of INTERNAL_TAB_IDS) {
  test(`${id}: no WCAG 2.2 AA violation at 1280 px`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.clock.setFixedTime(FIXTURE_NOW);
    await openDesk(page, id);
    expect(await violationsIn(page, `[data-internal-tab="${id}"]`)).toEqual([]);
  });
}

test("배송 안내 with a result and an open row: no WCAG 2.2 AA violation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, deliveredData());
  await openDesk(page, "delivery");
  await page.getByLabel("조회번호 (한 줄에 하나, 최대 20건)", { exact: true }).fill(FAKE.domestic);
  await page.getByRole("button", { name: "조회 시작", exact: true }).click();
  await page.locator(`[data-bulk-row="${FAKE.domestic}"]`).getByRole("button", { name: "화면 보기", exact: true }).click();
  await expect(page.locator(`[data-bulk-detail="${FAKE.domestic}"]`)).toBeVisible();
  expect(await violationsIn(page, '[data-internal-tab="delivery"]')).toEqual([]);
});
