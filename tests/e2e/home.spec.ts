import { expect, test } from "@playwright/test";
import { channels } from "@/config/site.config";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";

test.describe("site header (S06)", () => {
  test("a 48 px header shows the site name on the left and 문의 on the right, and nothing else", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header).toHaveCount(1);
    expect((await header.boundingBox())?.height).toBe(48);
    await expect(header.getByRole("link")).toHaveCount(2);
    const home = header.getByRole("link", { name: "통관·배송 조회", exact: true });
    const talk = header.getByRole("link", { name: "문의 새 창으로 열기", exact: true });
    await expect(home).toHaveAttribute("href", "/");
    await expect(talk).toHaveAttribute("href", channels.talk.url);
    await expect(talk).toHaveAttribute("target", "_blank");
    await expect(talk).toHaveAttribute("rel", "noopener noreferrer");
    await expect(talk).toHaveAttribute("data-link-placement", "header");
    expect((await home.boundingBox())?.x ?? 0).toBeLessThan((await talk.boundingBox())?.x ?? 0);
  });

  test("the same header sits on the home, a deep link and the privacy page", async ({ page }) => {
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
    for (const path of ["/", `/${FAKE.domestic}`, "/privacy"]) {
      await page.goto(path);
      const header = page.getByRole("banner");
      await expect(header.getByRole("link", { name: "통관·배송 조회", exact: true }), path).toBeVisible();
      await expect(header.getByRole("link", { name: "문의 새 창으로 열기", exact: true }), path).toBeVisible();
    }
  });

  test("the skip link stays off-screen until it is focused", async ({ page }) => {
    await page.goto("/");
    const skip = page.getByRole("link", { name: "본문으로 건너뛰기", exact: true });
    await expect(skip).toHaveAttribute("href", "#main-content");
    expect((await skip.boundingBox())?.y ?? 0).toBeLessThan(0);
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    expect((await skip.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
  });

  test("every public page has exactly one polite live region", async ({ page }) => {
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
    for (const path of ["/", `/${FAKE.domestic}`, "/privacy"]) {
      await page.goto(path);
      await expect(page.locator('[data-live-region="polite"]'), path).toHaveCount(1);
    }
  });
});
