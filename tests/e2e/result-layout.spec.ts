import { expect, test, type Page } from "@playwright/test";
import { siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { OCTOBER_NOW, customsWaitingData, failure, inTransitData, success } from "../fixtures/derive-scenarios";
import { FAKE, FIXTURE_NOW, mockTrack, trackData, type FailureFixture } from "../fixtures/tracking-fixtures";

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

interface LiveScene {
  readonly key: string;
  readonly reply: TrackResponseData | FailureFixture;
  readonly outcome: LookupOutcome;
  readonly now: Date;
}

const OVERDUE_NOW = new Date("2026-09-29T09:00:00+09:00");
/** Spec §6 / S05 Addition 5: header 48 + number bar 56 + status field ≤ 300 + gap 16 → 지금 할 일 starts by 420 px at 375×812. */
const NEXT_ACTION_TOP_MAX = 420;

function scene(key: string, data: TrackResponseData, now: Date = FIXTURE_NOW): LiveScene {
  return { key, reply: data, outcome: success(data), now };
}

const IN_TRANSIT = scene("inTransit", inTransitData(), OCTOBER_NOW);
const DELIVERED = scene("delivered", trackData("delivered"));
/** The §7 rows as a deep link shows them (the 8 key states of spec §13 plus the carrier-delay and NOT_FOUND rows). */
const KEY_SCENES: readonly LiveScene[] = [
  scene("pending", trackData("pending")),
  scene("customsWaiting", trackData("customsWaiting")),
  scene("customsCleared", trackData("customsCleared")),
  IN_TRANSIT,
  DELIVERED,
  scene("overdue", customsWaitingData(), OVERDUE_NOW),
  scene("stale", trackData("stale")),
  scene("lookupUnavailable", trackData("lookupUnavailableCarrier")),
  scene("ambiguous", trackData("ambiguous")),
  { key: "notFound", reply: "notFound404", outcome: failure("notFound"), now: FIXTURE_NOW }
];

function viewOf(item: LiveScene): TrackingViewModel {
  return deriveTrackingView(item.outcome, item.now, siteConfig);
}

/** Opens the scene as a deep link and waits for its status heading (the page clock reads the scene's `now`). */
async function openScene(page: Page, item: LiveScene): Promise<void> {
  await page.clock.setFixedTime(item.now);
  await blockOtherHosts(page);
  await mockTrack(page, item.reply);
  await page.goto(`/${typeof item.reply === "string" ? FAKE.domestic : item.reply.trackingNumber}`);
  await expect(page.locator("[data-result-view] h2")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function bottomOf(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).first().boundingBox();
  return box === null ? Number.POSITIVE_INFINITY : box.y + box.height;
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe("result page layout (Task 9)", () => {
  test("the live result keeps the fixed order, with no store, ad or recommendation before the primary end", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openScene(page, IN_TRANSIT);
    const chain = [
      "[data-number-bar]",
      "[data-result-view] h2",
      '[data-result-view] [data-slot="eta"]',
      "[data-result-view] [data-cta-state]",
      "[data-result-view] [data-last-event]",
      "[data-result-view] [data-primary-end]"
    ];
    const outOfOrder = await page.evaluate((selectors) => {
      const nodes = selectors.map((selector) => document.querySelector(selector));
      return selectors.filter((selector, index) => {
        const node = nodes[index] ?? null;
        if (node === null) return true;
        const previous = index === 0 ? null : (nodes[index - 1] ?? null);
        return previous !== null && (previous.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) === 0;
      });
    }, chain);
    expect(outOfOrder).toEqual([]);
    const between = await page.evaluate(() => {
      const start = document.querySelector("[data-number-bar]");
      const end = document.querySelector("[data-result-view] [data-primary-end]");
      if (start === null || end === null) return -1;
      return Array.from(document.querySelectorAll("[data-recommended-products], [data-ad-slot], ins.adsbygoogle, [data-affiliate-group]")).filter(
        (node) =>
          (start.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
          (node.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      ).length;
    });
    expect(between).toBe(0);
  });

  test("375×812: status, ETA and 지금 할 일 are in the first view in every key state", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });
    for (const item of KEY_SCENES) {
      const view = viewOf(item);
      await openScene(page, item);
      expect(await bottomOf(page, "[data-result-view] h2"), `${item.key}: status`).toBeLessThanOrEqual(812);
      if (view.eta.kind !== "none") {
        expect(await bottomOf(page, '[data-result-view] [data-slot="eta"]'), `${item.key}: ETA`).toBeLessThanOrEqual(812);
      }
      const cta = page.locator("[data-result-view] [data-cta-state]");
      const sentence = await cta.getByText(view.nextAction.sentence, { exact: true }).boundingBox();
      const top = (await cta.boundingBox())?.y ?? Number.POSITIVE_INFINITY;
      // Printed for the stage gate (G8).
      console.info(`[budget] 지금 할 일 top at 375x812 (${item.key}): ${Math.round(top)} px`);
      expect(sentence === null ? Number.POSITIVE_INFINITY : sentence.y + sentence.height, `${item.key}: 지금 할 일`).toBeLessThanOrEqual(812);
    }
  });

  test("B field cap: in plain states the status field fits --tt-status-field-max and 지금 할 일 starts by 420 px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const item of [IN_TRANSIT, DELIVERED]) {
      await openScene(page, item);
      const fieldMax = await page.evaluate(() =>
        Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tt-status-field-max"))
      );
      const field = await page.locator('[data-result-view] [data-slot="status-head"]').boundingBox();
      const cta = await page.locator("[data-result-view] [data-cta-state]").boundingBox();
      const height = field?.height ?? Number.POSITIVE_INFINITY;
      const top = cta?.y ?? Number.POSITIVE_INFINITY;
      // Printed for the stage gate (G8).
      console.info(
        `[budget] status field at 375x812 (${item.key}): ${Math.round(height)} px (max ${fieldMax} px); 지금 할 일 top ${Math.round(top)} px (max ${NEXT_ACTION_TOP_MAX} px)`
      );
      expect(fieldMax).toBe(300);
      expect(height, item.key).toBeLessThanOrEqual(fieldMax);
      expect(top, item.key).toBeLessThanOrEqual(NEXT_ACTION_TOP_MAX);
    }
  });

  test("desktop 1440: the 560 px result and the 320 px side column sit side by side under the number bar; '/' stays one 560 px column", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openScene(page, IN_TRANSIT);
    const bar = await page.locator("[data-number-bar]").boundingBox();
    const main = await page.locator("[data-result-main]").boundingBox();
    const side = await page.locator("[data-side-column]").boundingBox();
    expect(Math.round(main?.width ?? 0)).toBe(560);
    expect(Math.round(side?.width ?? 0)).toBe(320);
    expect(side?.x ?? 0).toBeGreaterThan((main?.x ?? 0) + (main?.width ?? 0));
    expect(Math.abs((side?.y ?? 0) - (main?.y ?? 0))).toBeLessThanOrEqual(1);
    expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeLessThanOrEqual((main?.y ?? 0) + 1);
    await expect(page.locator("[data-history-recent]")).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    await page.goto("/");
    const idle = await page.locator('[data-view-state="idle"]').boundingBox();
    expect(Math.round(idle?.width ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(560);
  });

  test("320 px: no horizontal scroll in pending, delivered, ambiguous and NOT_FOUND results", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 320, height: 800 });
    for (const item of KEY_SCENES.filter((candidate) => ["pending", "delivered", "ambiguous", "notFound"].includes(candidate.key))) {
      await openScene(page, item);
      expect(await horizontalOverflow(page), item.key).toBeLessThanOrEqual(0);
    }
  });
});
