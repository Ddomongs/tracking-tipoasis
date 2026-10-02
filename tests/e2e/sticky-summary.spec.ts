import { expect, test, type Page } from "@playwright/test";
import { channels, disclosures } from "@/config/site.config";
import { FAKE, FIXTURE_NOW, mockTrack, trackData, type FixtureState } from "../fixtures/tracking-fixtures";

/** 10월 2일 요청: 스크롤해도 문의·도착 예상·스토어 바로가기가 보이고, 푸터에서 관리자 화면으로 갈 수 있습니다. */
test.use({ viewport: { width: 375, height: 812 } });

const band = (page: Page) => page.locator("[data-sticky-summary]");

async function openResult(page: Page, state: FixtureState): Promise<void> {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, trackData(state, { trackingNumber: FAKE.domestic }));
  await page.goto(`/${FAKE.domestic}`);
  await expect(page.locator("[data-result-view] [data-guide-key]")).toHaveAttribute("data-guide-key", state);
}

async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
}

test("the header with '문의' stays on screen after scrolling", async ({ page }) => {
  await openResult(page, "inTransit");
  await scrollToBottom(page);
  const headerTalk = page.locator("header").locator(`a[href="${channels.talk.url}"]`);
  await expect(headerTalk).toBeInViewport();
  const box = await page.locator("header").boundingBox();
  expect(box?.y).toBe(0);
});

test("the band is absent at the top and shows the ETA once the status card scrolls away; in transit it has no stores", async ({ page }) => {
  await openResult(page, "inTransit");
  await expect(band(page)).toHaveCount(0);
  await scrollToBottom(page);
  await expect(band(page)).toBeVisible();
  await expect(band(page)).toBeInViewport();
  await expect(band(page)).toContainText("도착 예상");
  await expect(band(page).locator("a")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(band(page)).toHaveCount(0);
});

test("delivered: the band carries the store links behind the definitive disclosure", async ({ page }) => {
  await openResult(page, "delivered");
  await scrollToBottom(page);
  await expect(band(page)).toBeVisible();
  await expect(band(page)).toContainText(disclosures.coupang);
  const coupang = band(page).locator('[data-sticky-store="coupang"]');
  await expect(coupang).toHaveAttribute("rel", /sponsored nofollow/);
  await expect(coupang).toHaveAttribute("target", "_blank");
  await expect(band(page).locator('[data-sticky-store="naver"]')).not.toHaveAttribute("rel", /sponsored/);
});

test("the band adds no 톡톡 place: at most three per screen", async ({ page }) => {
  await openResult(page, "customsWaiting");
  await scrollToBottom(page);
  await expect(band(page)).toBeVisible();
  expect(await page.locator(`a[href="${channels.talk.url}"]`).count()).toBeLessThanOrEqual(3);
});

test("the footer links staff to the CS desk", async ({ page }) => {
  await page.goto("/");
  const admin = page.locator("footer").getByRole("link", { name: "관리자", exact: true });
  await expect(admin).toHaveAttribute("href", "/internal/cs-helper");
});
