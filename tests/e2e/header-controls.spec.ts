import { expect, test } from "@playwright/test";
import { channels } from "@/config/site.config";

/** 10월 2일 요청: 헤더의 문의는 말풍선이 있는 버튼, 옆에 해·달 동그란 버튼으로 어두운 화면을 켜고 끕니다. */
test("the header '문의' is an outlined button with the speech bubble", async ({ page }) => {
  await page.goto("/");
  const talk = page.locator("header").locator(`a[href="${channels.talk.url}"]`);
  await expect(talk).toHaveAttribute("data-variant", "secondary");
  await expect(talk.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  await expect(talk).toHaveText(channels.talk.labels.header);
});

test("the round button switches to the dark style, remembers it and switches back", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const toggle = page.locator("header").getByRole("button", { name: "어두운 화면" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-style", "night");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-style-picker] input[value='night']")).toBeChecked();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-style", "night");
  await expect(page.locator("header").getByRole("button", { name: "어두운 화면" })).toHaveAttribute("aria-pressed", "true");
  await page.locator("header").getByRole("button", { name: "어두운 화면" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-style", "signal");
});

test("the toggle is round and at least 44 px", async ({ page }) => {
  await page.goto("/");
  const toggle = page.locator("[data-theme-toggle]");
  const box = await toggle.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(await toggle.evaluate((element) => getComputedStyle(element).borderRadius)).not.toBe("0px");
});
