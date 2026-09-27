import { expect, test } from "@playwright/test";
import { STYLE_COLOR_TOKENS } from "@/lib/style/tokens";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";

// Basic-auth credentials are sent only when a route challenges (the /internal/* pages).
test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

test.describe("root layout wiring", () => {
  test("pages render html[data-style=signal] with the signal tokens and only the DM Mono web font", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-style", "signal");
    const ground = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--tt-ground").trim().toUpperCase()
    );
    expect(ground).toBe(STYLE_COLOR_TOKENS.signal?.["--tt-ground"]);
    const families = await page.evaluate(async () => {
      await document.fonts.ready;
      return Array.from(document.fonts, (font) => font.family);
    });
    expect(families.some((family) => /DM[_ ]Mono/.test(family))).toBe(true);
    expect(families.filter((family) => /IBM[_ ]Plex|Space[_ ]Grotesk/.test(family))).toEqual([]);
    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(bodyFont).toMatch(/Apple SD Gothic Neo|Malgun Gothic/);
  });
});
