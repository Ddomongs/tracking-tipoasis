import { expect, test, type Page } from "@playwright/test";
import { deriveResultView } from "@/components/result/approvals";
import { siteConfig } from "@/config/site.config";
import { groupNoticesAt, holidayAt, noticePlacementAt, type NoticeWindow } from "@/lib/cs/notice-status";
import { buildPreviewScenario } from "@/lib/cs/preview-outcomes";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";
import { openDesk } from "../support/internal-desk";

test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

const TIME_LABEL = "기준 시각 (한국 시간)";
const FIXTURE_INPUT = "2026-09-26T14:05";
const NONE = "없음";
const WINDOWS: readonly NoticeWindow[] = ["active", "scheduled", "expired"];
/** A datetime-local value read as Korean time. */
const kst = (local: string): Date => new Date(`${local}:00+09:00`);

async function openNotices(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await openDesk(page, "notices");
}

async function chooseTime(page: Page, local: string): Promise<void> {
  await page.getByLabel(TIME_LABEL, { exact: true }).fill(local);
  await expect(page.locator("[data-notice-simulation]")).toHaveAttribute("data-notice-simulation", kst(local).toISOString());
}

async function expectListsAt(page: Page, at: Date): Promise<void> {
  const groups = groupNoticesAt(siteConfig.notices, at);
  for (const window of WINDOWS) {
    const ids = await page
      .locator(`[data-notice-group="${window}"] [data-notice-id]`)
      .evaluateAll((items) => items.map((item) => item.getAttribute("data-notice-id")));
    expect(ids, window).toEqual(groups[window].map((notice) => notice.id));
  }
}

test("the time starts at the current Korean time and the notice lists follow the chosen time", async ({ page }) => {
  await openNotices(page);
  await expect(page.getByLabel(TIME_LABEL, { exact: true })).toHaveValue(FIXTURE_INPUT);
  await expect(page.locator("[data-notice-simulation]")).toHaveAttribute("data-notice-simulation", FIXTURE_NOW.toISOString());
  await expectListsAt(page, FIXTURE_NOW);
  for (const local of ["2026-10-05T09:00", "2026-09-01T00:00"]) {
    await chooseTime(page, local);
    await expectListsAt(page, kst(local));
  }
});

test("the places show the home notice, the CS notices and the result states of that time", async ({ page }) => {
  await openNotices(page);
  const placement = noticePlacementAt(siteConfig.notices, FIXTURE_NOW);
  const places = page.locator("[data-notice-places]");
  const results = placement.results.map(({ guideKey, notice }) => `${siteConfig.stateGuide[guideKey].docTitle}: ${notice.title}`);
  await expect(places.locator('[data-place="home"]')).toHaveText(placement.home?.title ?? NONE);
  await expect(places.locator('[data-place="cs"]')).toHaveText(placement.cs.length === 0 ? NONE : placement.cs.map((notice) => notice.title).join(" · "));
  await expect(places.locator('[data-place="results"]')).toHaveText(results.length === 0 ? NONE : results.join(" / "));
});

test("the holiday line names the holiday of that Korean day", async ({ page }) => {
  await openNotices(page);
  for (const local of ["2026-09-25T10:00", "2026-10-14T10:00"]) {
    await chooseTime(page, local);
    const holiday = holidayAt(kst(local), siteConfig.calendar);
    const line = page.locator("[data-notice-holiday]");
    await expect(line).toHaveAttribute("data-notice-holiday", holiday?.id ?? "none");
    if (holiday !== null) await expect(line).toContainText(holiday.badge);
  }
});

test("the simulated screens show that time's in-card notice, holiday badge and the overdue screen", async ({ page }) => {
  await openNotices(page);
  for (const [id, overdue] of [
    ["customsWaiting", false],
    ["customsWaitingOverdue", true]
  ] as const) {
    const view = deriveResultView(buildPreviewScenario(id, FIXTURE_NOW).outcome, FIXTURE_NOW);
    expect(view.overdue).toBe(overdue);
    const screen = page.locator(`[data-simulated-screen="${id}"]`);
    await expect(screen.locator("[data-overdue]").first()).toHaveAttribute("data-overdue", String(overdue));
    await expect(screen.locator('[data-slot="eta"]').first()).toHaveAttribute("data-eta-kind", view.eta.kind);
    if (view.notice !== null) await expect(screen.locator('[data-notice-variant="inline"]')).toContainText(view.notice.body);
  }
});

test("an incomplete time asks for both parts", async ({ page }) => {
  await openNotices(page);
  await page.getByLabel(TIME_LABEL, { exact: true }).fill("");
  await expect(page.locator('[data-internal-tab="notices"]').getByRole("alert")).toHaveText("날짜와 시각을 모두 골라 주세요.");
  await expect(page.locator("[data-notice-simulation]")).toHaveCount(0);
});

test("[지금으로] returns to the current Korean time", async ({ page }) => {
  await openNotices(page);
  await chooseTime(page, "2026-10-05T09:00");
  await page.getByRole("button", { name: "지금으로", exact: true }).click();
  await expect(page.getByLabel(TIME_LABEL, { exact: true })).toHaveValue(FIXTURE_INPUT);
});

test.describe("a browser in America/New_York", () => {
  test.use({ timezoneId: "America/New_York" });

  test("still simulates Korean time", async ({ page }) => {
    await openNotices(page);
    await expect(page.getByLabel(TIME_LABEL, { exact: true })).toHaveValue(FIXTURE_INPUT);
    await chooseTime(page, "2026-09-24T00:30");
    const holiday = holidayAt(kst("2026-09-24T00:30"), siteConfig.calendar);
    await expect(page.locator("[data-notice-holiday]")).toHaveAttribute("data-notice-holiday", holiday?.id ?? "none");
  });
});
