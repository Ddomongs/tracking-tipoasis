import { test, expect } from "@playwright/test";

test("home renders input and button", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("조회번호")).toBeVisible();
  await expect(page.getByRole("button", { name: "조회하기" })).toBeVisible();
});
