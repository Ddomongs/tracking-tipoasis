import { expect, test } from "@playwright/test";
import { channels } from "@/config/site.config";

/** 10월 2일 요청: 휴대폰에서 아래로 내리면 하단 바가 올라옵니다(새로 조회·통관 가이드·맨 위로). PC에는 없습니다. */
test("phone: the bar is below the screen at the top and slides in after a scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/guide/faq");
  const bar = page.getByRole("navigation", { name: "바로 가기" });
  await expect(bar).toBeAttached();
  await expect(bar.getByRole("link")).toHaveText(["새로 조회", "통관 가이드", "맨 위로"]);
  await expect(bar).not.toBeInViewport({ ratio: 1 });
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect(bar).toBeInViewport({ ratio: 1 });
  for (const link of await bar.getByRole("link").all()) expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(bar.locator(`a[href="${channels.talk.url}"]`)).toHaveCount(0);
});

test("reduced motion: the bar is simply there", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/guide");
  await expect(page.getByRole("navigation", { name: "바로 가기" })).toBeInViewport({ ratio: 1 });
});

test("desktop: no bar", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "바로 가기" })).toBeHidden();
});
