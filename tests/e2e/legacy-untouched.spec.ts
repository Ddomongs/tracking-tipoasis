import { expect, test } from "@playwright/test";
import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";

// S05 adds tokens.css rules keyed by data-* hooks; the legacy result screen (until S07) shares some hook
// names, so its store disclosure must keep its own look (slate-600, 12/20px, regular weight).
test("the legacy store disclosure keeps its own look under the S05 token rules", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, trackData("delivered"));
  await page.goto(`/${FAKE.domestic}`);
  const disclosure = page.locator("[data-cta-state] [data-affiliate-disclosure]");
  await expect(disclosure).toBeVisible();
  const look = await disclosure.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, lineHeight: style.lineHeight, fontWeight: style.fontWeight };
  });
  expect(look).toEqual({ color: "rgb(71, 85, 105)", lineHeight: "20px", fontWeight: "400" });
});
