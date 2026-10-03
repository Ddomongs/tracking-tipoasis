import { expect, test } from "@playwright/test";
import { channels } from "@/config/site.config";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/settings";
import { FAKE, FIXTURE_NOW, mockTrack, trackData, type FixtureState } from "../fixtures/tracking-fixtures";

/** 10월 2일 요청: 기사님·고객센터 바로 전화(번호는 일부 가림)와 정상 결과 아래 스토어 안내 카드. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
});

async function open(page: import("@playwright/test").Page, state: FixtureState): Promise<void> {
  await mockTrack(page, trackData(state, { trackingNumber: FAKE.domestic }));
  await page.goto(`/${FAKE.domestic}`);
  await expect(page.locator('[data-result-view="settled"]')).toBeVisible();
}

test("in transit with a driver number: the call button shows a masked number and dials the full one", async ({ page }) => {
  await open(page, "inTransitWithDriver");
  const call = page.locator("[data-cta-state]").getByRole("link", { name: /기사님께 전화/ });
  await expect(call).toHaveAttribute("href", `tel:${FAKE.phone.replace(/-/g, "")}`);
  await expect(call.locator("[data-call-detail]")).toHaveText("010-****-1234");
  await expect(page.getByText(FAKE.phone)).toHaveCount(0);
});

test("delivered: the 미수령 button opens the help with one call button to the carrier's center", async ({ page }) => {
  await open(page, "delivered");
  await page.getByRole("button", { name: "수령이 안 됐다면 여기를 눌러 주세요" }).click();
  const contact = page.locator("[data-delivered-help] [data-delivered-contact]");
  await expect(contact).toBeVisible();
  const call = contact.getByRole("link");
  await expect(call).toHaveCount(1);
  await expect(call).toHaveAttribute("href", /^tel:\d+$/);
});

test("in transit: the store invitation sits under the result, never sponsored, and adds no 톡톡 place", async ({ page }) => {
  await open(page, "inTransit");
  const promo = page.locator("[data-result-promo]");
  await expect(promo.getByRole("heading", { level: 3 })).toHaveText(DEFAULT_SITE_SETTINGS.resultPromoTitle);
  const link = promo.getByRole("link", { name: `${DEFAULT_SITE_SETTINGS.resultPromoButtonLabel} 새 창으로 열기` });
  await expect(link).toHaveAttribute("href", DEFAULT_SITE_SETTINGS.naverUrl);
  await expect(link).not.toHaveAttribute("rel", /sponsored/);
  expect(await page.locator(`a[href="${channels.talk.url}"]`).count()).toBeLessThanOrEqual(3);
});

for (const state of ["delivered", "pending", "stale"] as const) {
  test(`${state}: no store invitation card (its own stores lead, or something is wrong)`, async ({ page }) => {
    await open(page, state);
    await expect(page.locator("[data-result-promo]")).toHaveCount(0);
  });
}

test("customs waiting: the reference-only clearance card with the arrival day and the day count", async ({ page }) => {
  await open(page, "customsWaiting");
  const card = page.locator("[data-customs-estimate]");
  await expect(card.getByRole("heading", { level: 3 })).toHaveText("통관 완료 예상일");
  await expect(card).toContainText("참고용 · 확정된 날짜 아님");
  await expect(card).toContainText("내 입항일");
  await expect(card.locator("[data-customs-dday]")).toHaveText(/^(오늘|D-\d+)$/);
});

test("delivered: the 미수령 help names the carrier and points to the driver's message; the button is outlined", async ({ page }) => {
  await open(page, "delivered");
  const open_ = page.getByRole("button", { name: "수령이 안 됐다면 여기를 눌러 주세요" });
  await expect(open_).toHaveAttribute("data-variant", "secondary");
  await open_.click();
  await expect(page.locator("[data-delivered-sms]")).toContainText("배송 완료 문자");
});
