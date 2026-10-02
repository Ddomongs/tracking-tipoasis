import { expect, test } from "@playwright/test";
import { channels } from "@/config/site.config";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/settings";
import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";

/** 10월 2일 요청: 조회하는 동안 결과 자리에 구매대행 상담 카드를 보여 주고 톡톡으로 연결합니다(조회 시간은 늘리지 않음). */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
});

test("while a lookup runs, the card invites a 톡톡 chat in a new tab; at most three 톡톡 places", async ({ page }) => {
  await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 30_000 });
  await page.goto(`/${FAKE.domestic}`);
  const promo = page.locator("[data-loading-stage] [data-loading-promo]");
  await expect(promo).toBeVisible();
  await expect(promo.getByRole("heading", { level: 3 })).toHaveText(DEFAULT_SITE_SETTINGS.loadingTitle);
  await expect(promo).toContainText(DEFAULT_SITE_SETTINGS.loadingBody);
  const talk = promo.getByRole("link", { name: `${DEFAULT_SITE_SETTINGS.loadingButtonLabel} 새 창으로 열기` });
  await expect(talk).toHaveAttribute("href", channels.talk.url);
  await expect(talk).toHaveAttribute("target", "_blank");
  await expect(talk).toHaveAttribute("data-link-placement", "state");
  expect(await page.locator(`a[href="${channels.talk.url}"]`).count()).toBeLessThanOrEqual(3);
});

test("the card leaves with the loading screen and never delays the result", async ({ page }) => {
  await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 800 });
  await page.goto(`/${FAKE.domestic}`);
  await expect(page.locator("[data-loading-promo]")).toBeVisible();
  await expect(page.locator('[data-result-view="settled"]')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator("[data-loading-promo]")).toHaveCount(0);
});

test("a manual lookup from the home shows the card too", async ({ page }) => {
  await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 30_000 });
  await page.goto("/");
  await page.getByRole("textbox", { name: /조회번호/ }).fill(FAKE.domestic);
  await page.getByRole("button", { name: "조회하기" }).click();
  await expect(page.locator("[data-loading-stage] [data-loading-promo]")).toBeVisible();
});
