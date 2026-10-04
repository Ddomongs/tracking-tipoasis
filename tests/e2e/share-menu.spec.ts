import { expect, test } from "@playwright/test";
import { FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";

/** 10월 4일 요청: 헤더의 공유 버튼 — 링크 복사와 휴대폰 공유창(카카오톡 등). */
test("the share button opens a menu that copies this page's link", async ({ page, context, request }) => {
  expect(await (await request.get("/")).text()).not.toContain("data-share-toggle");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/guide");
  const share = page.locator("[data-site-header]").getByRole("button", { name: "공유하기" });
  await share.click();
  const menu = page.getByRole("dialog", { name: "이 페이지 공유하기" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("textbox", { name: "공유할 링크" })).toHaveValue(/\/guide$/);
  await menu.getByRole("button", { name: "링크 복사" }).click();
  await expect(menu.locator("[data-share-status]")).toHaveText("링크를 복사했어요. 원하는 곳에 붙여 넣어 주세요.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/guide$/);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test("on a result the number is ticked by default (10월 4일 요청); unticking sends the site only; the share sheet gets the link", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await page.addInitScript(() => {
    const calls: ShareData[] = [];
    (window as unknown as { __shared: ShareData[] }).__shared = calls;
    Object.defineProperty(navigator, "share", { configurable: true, value: (data: ShareData) => { calls.push(data); return Promise.resolve(); } });
  });
  const number = trackData("inTransit").trackingNumber;
  await mockTrack(page, trackData("inTransit"));
  await page.goto(`/${number}`);
  await expect(page.locator("[data-result-view]")).toBeVisible();
  await page.locator("[data-site-header]").getByRole("button", { name: "공유하기" }).click();
  const menu = page.getByRole("dialog", { name: "이 페이지 공유하기" });
  const link = menu.getByRole("textbox", { name: "공유할 링크" });
  const tick = menu.getByRole("checkbox", { name: /조회번호도 함께 보내기/ });
  await expect(tick).toBeChecked();
  await expect(link).toHaveValue(new RegExp(`/${number}$`));
  await tick.uncheck();
  await expect(link).toHaveValue(/\/$/);
  await tick.check();
  await menu.getByRole("button", { name: "카카오톡·메시지로 보내기" }).click();
  const shared = await page.evaluate(() => (window as unknown as { __shared: ShareData[] }).__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0]?.url).toMatch(new RegExp(`/${number}$`));
});

test("the number bar shows the number without spaces (10월 4일 요청)", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, trackData("inTransit"));
  await page.goto(`/${trackData("inTransit").trackingNumber}`);
  await expect(page.locator("[data-number-bar-value]")).toHaveText(trackData("inTransit").trackingNumber.toUpperCase());
});

test("360 px: header buttons fit without overlapping the site name", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  const share = page.locator("[data-site-header]").getByRole("button", { name: "공유하기" });
  await expect(share).toBeVisible();
  const name = await page.locator("[data-site-header] a").first().boundingBox();
  const box = await share.boundingBox();
  expect((name?.x ?? 0) + (name?.width ?? 0)).toBeLessThanOrEqual(box?.x ?? 0);
  await expect(page.locator("[data-site-hero]").getByRole("button", { name: "효과음" })).toBeVisible();
});
