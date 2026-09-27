import { expect, test, type Page } from "@playwright/test";
import { siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { success } from "../fixtures/derive-scenarios";
import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";

const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";

async function blockOtherHosts(page: Page): Promise<void> {
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

async function openDeepLink(page: Page, delayMs: number, state: Parameters<typeof trackData>[0] = "customsWaiting"): Promise<void> {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await blockOtherHosts(page);
  await mockTrack(page, trackData(state), { delayMs });
  await page.goto(`/${FAKE.hbl}`);
}

/** Records every non-empty text the one polite live region shows. */
async function recordLiveRegion(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const texts: string[] = [];
    Object.defineProperty(window, "__ttLiveTexts", { value: texts });
    const attach = (): void => {
      const region = document.querySelector("[data-live-region]");
      if (region === null) {
        requestAnimationFrame(attach);
        return;
      }
      new MutationObserver(() => {
        const text = (region.textContent ?? "").trim();
        if (text !== "") texts.push(text);
      }).observe(region, { childList: true, characterData: true, subtree: true });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach);
    else attach();
  });
}

async function liveTexts(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__ttLiveTexts");
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
  });
}

/** Sums layout-shift values without recent input into window.__ttCls (resettable from the test). */
async function installLayoutShiftMeter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let total = 0;
    Object.defineProperty(window, "__ttCls", {
      get: () => total,
      set: (value: number) => {
        total = value;
      }
    });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { readonly value?: number; readonly hadRecentInput?: boolean };
        if (shift.hadRecentInput !== true) total += shift.value ?? 0;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

test.describe("focus, live sentence, title and fill", () => {
  test("after a manual lookup focus moves to the status h2, which is not an alert, without scrolling", async ({ page }) => {
    await page.clock.setFixedTime(FIXTURE_NOW);
    await blockOtherHosts(page);
    await mockTrack(page, trackData("inTransit"));
    await page.goto("/");
    const input = page.getByLabel(INPUT_LABEL, { exact: true });
    await input.fill(FAKE.hbl);
    await input.press("Enter");
    const heading = page.locator("[data-result-view] h2");
    await expect(heading).toBeFocused();
    expect(await heading.getAttribute("role")).toBeNull();
    await expect(page.locator('[data-result-view] [role="alert"], [data-result-view] [role="status"], [data-result-view] [aria-live]')).toHaveCount(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("a deep link moves focus to the status h2 when the customer did nothing", async ({ page }) => {
    await openDeepLink(page, 600);
    await expect(page.locator("[data-result-view] h2")).toBeFocused();
  });

  test("a deep link leaves focus alone when the customer pressed a key while it loaded", async ({ page }) => {
    await openDeepLink(page, 2_000);
    await expect(page.locator("[data-loading-stage]")).toBeVisible();
    await page.keyboard.press("Tab");
    const heading = page.locator("[data-result-view] h2");
    await expect(heading).toBeVisible();
    await expect(heading).not.toBeFocused();
  });

  test("the one polite live region reads the result sentence exactly once", async ({ page }) => {
    const view = deriveTrackingView(success(trackData("customsWaiting")), FIXTURE_NOW, siteConfig);
    await recordLiveRegion(page);
    await openDeepLink(page, 800);
    await expect(page.locator("[data-result-view] h2")).toBeVisible();
    await expect.poll(() => liveTexts(page)).toContain(view.liveMessage);
    // A duplicate announcement (for example from an old settle handler) would arrive within this time.
    await page.waitForTimeout(800);
    await expect(page.locator("[data-live-region]")).toHaveCount(1);
    expect((await liveTexts(page)).filter((text) => text === view.liveMessage)).toHaveLength(1);
  });

  test("the document title names the state, never the number", async ({ page }) => {
    const view = deriveTrackingView(success(trackData("customsWaiting")), FIXTURE_NOW, siteConfig);
    await openDeepLink(page, 1_000);
    await expect(page.locator("[data-loading-stage]")).toBeVisible();
    expect(await page.title()).not.toBe(view.documentTitle);
    await expect(page).toHaveTitle(view.documentTitle);
    expect(await page.title()).not.toMatch(/\d{4}/);
  });

  test("the result fills the loading card's place: no scroll jump and CLS ≤ 0.05 at 375×812", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await installLayoutShiftMeter(page);
    await openDeepLink(page, 1_200);
    const loadingCard = page.locator("[data-loading-stage]");
    await expect(loadingCard).toBeVisible();
    const before = await loadingCard.evaluate((element) => ({ top: element.getBoundingClientRect().top, scroll: window.scrollY }));
    await page.evaluate(() => {
      Reflect.set(window, "__ttCls", 0);
    });
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card).toBeVisible();
    const after = await card.evaluate((element) => ({ top: element.getBoundingClientRect().top, scroll: window.scrollY }));
    expect(after.scroll).toBe(before.scroll);
    expect(Math.abs(after.top - before.top)).toBeLessThanOrEqual(1);
    const cls = await page.evaluate(() => Number(Reflect.get(window, "__ttCls")));
    // Printed for the stage gate (G8).
    console.info(`[budget] result fill CLS at 375x812: ${cls.toFixed(3)} (max 0.05)`);
    expect(cls).toBeLessThanOrEqual(0.05);
  });
});

test.describe("one result area (Task 9)", () => {
  test("the lookup area says loading while the card waits and settled once the result shows", async ({ page }) => {
    const view = deriveTrackingView(success(trackData("customsWaiting")), FIXTURE_NOW, siteConfig);
    await openDeepLink(page, 1_500);
    await expect(page.locator('[data-view-state="loading"] [data-loading-stage]')).toBeVisible();
    await expect(page.locator('[data-view-state="settled"] [data-result-view="settled"]')).toBeVisible();
    await expect(page.locator("[data-number-bar]")).toContainText(view.carrier.barLabel);
  });

  test("a failed lookup reports error on the lookup area", async ({ page }) => {
    await page.clock.setFixedTime(FIXTURE_NOW);
    await blockOtherHosts(page);
    await mockTrack(page, "notFound404");
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-view-state="error"] [data-result-view="error"]')).toBeVisible();
  });

  test("focus in the lookup form downloads the result module before any lookup", async ({ page }) => {
    await blockOtherHosts(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const resultChunk = page.waitForResponse(async (response) => {
      if (response.request().resourceType() !== "script") return false;
      if (!new URL(response.url()).pathname.startsWith("/_next/")) return false;
      return (await response.text()).includes("data-primary-end");
    });
    await page.getByLabel(INPUT_LABEL, { exact: true }).focus();
    await resultChunk;
  });
});
