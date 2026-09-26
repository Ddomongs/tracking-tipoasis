import { expect, test, type Locator } from "@playwright/test";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";
import { FAKE } from "../fixtures/tracking-fixtures";

/** Spec §12 "SSR opacity:0은 금지": an inline style that hides content until JavaScript runs. */
const SSR_HIDDEN_STYLE = /style="[^"]*\bopacity:\s*0(?![.\d])/;

async function effectiveOpacity(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    let opacity = 1;
    for (let node: Element | null = element; node; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    return opacity;
  });
}

test.describe("first paint (S01)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");

  for (const route of [
    { name: "home", path: "/" },
    { name: "deep link", path: `/${FAKE.domestic}` }
  ] as const) {
    test(`${route.name}: the server HTML hides nothing with an inline opacity:0`, async ({ request }) => {
      const response = await request.get(route.path);
      expect(response.status()).toBe(200);
      expect(await response.text()).not.toMatch(SSR_HIDDEN_STYLE);
    });
  }

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("home: the heading and the lookup input are painted from the server HTML", async ({ page }) => {
      await page.goto("/");
      const heading = page.getByRole("heading", { level: 1, name: "통관부터 국내 배송까지 한 번에 확인" });
      const input = page.getByRole("textbox", { name: "조회번호 (HBL 또는 운송장)", exact: true });
      await expect(heading).toBeVisible();
      await expect(input).toBeVisible();
      expect(await effectiveOpacity(heading)).toBe(1);
      expect(await effectiveOpacity(input)).toBe(1);
    });
  });
});
