import { expect, test } from "@playwright/test";
import { FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";

/** 10월 4일 요청: 배송 완료 화면의 두 버튼. */
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.clock.setFixedTime(FIXTURE_NOW);
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
  await mockTrack(page, trackData("delivered"));
  await page.goto(`/${trackData("delivered").trackingNumber}`);
  await expect(page.locator("[data-result-view]")).toBeVisible();
});

test("[수령이 안 됐다면 여기를 눌러 주세요] opens 미수령 안내 and brings the call button on screen", async ({ page }) => {
  await page.locator('[data-cta-state="delivered"]').getByRole("button", { name: "수령이 안 됐다면 여기를 눌러 주세요" }).click();
  await expect(page.locator("details[data-delivered-help]")).toHaveAttribute("open", "");
  await expect(page.locator("[data-delivered-contact]")).toBeInViewport({ ratio: 1 });
});

test("[톡톡으로 문의하기] copies the inquiry text in the same click that opens 톡톡", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const talk = page.locator('[data-cta-state="delivered"] a[data-link-placement="state"]');
  await expect(talk).toHaveAttribute("target", "_blank");
  const popup = page.waitForEvent("popup");
  await talk.click();
  await (await popup).close();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("[배송 문의] 조회번호 ");
  expect(copied).toContain(trackData("delivered").trackingNumber.toUpperCase());
});
