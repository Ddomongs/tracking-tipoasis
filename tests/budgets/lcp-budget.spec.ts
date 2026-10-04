import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { lookup } from "@/config/site.config";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";

interface NetworkProfile {
  readonly name: string;
  readonly latencyMs: number;
  readonly downloadBytesPerSecond: number;
  readonly uploadBytesPerSecond: number;
  readonly cpuSlowdown: number;
}

/**
 * Chrome DevTools "Slow 4G" — the throttling Lighthouse applies in DevTools mode for its mobile run (RTT 150 ms × 3.75,
 * 1.6 Mbps × 0.9 down, 750 kbps × 0.9 up) — with Lighthouse's mobile CPU slowdown × 4. Spec §12: '/' LCP ≤ 2.0 s.
 */
const SLOW_4G: NetworkProfile = {
  name: "Slow 4G",
  latencyMs: 150 * 3.75,
  downloadBytesPerSecond: ((1.6 * 1000 * 1000) / 8) * 0.9,
  uploadBytesPerSecond: ((750 * 1000) / 8) * 0.9,
  cpuSlowdown: 4
};
/** Chrome DevTools "Fast 4G" (RTT 60 ms × 2.75, 9 Mbps × 0.9 down, 1.5 Mbps × 0.9 up), CPU not slowed. Spec §12: ≤ 1.0 s. */
const FAST_4G: NetworkProfile = {
  name: "Fast 4G",
  latencyMs: 60 * 2.75,
  downloadBytesPerSecond: ((9 * 1000 * 1000) / 8) * 0.9,
  uploadBytesPerSecond: ((1.5 * 1000 * 1000) / 8) * 0.9,
  cpuSlowdown: 1
};
const LCP_BUDGET_MS = 2000;
const FCP_BUDGET_MS = 1000;
const CLS_BUDGET = 0.05;

async function throttle(page: Page, profile: NetworkProfile): Promise<CDPSession> {
  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: profile.latencyMs,
    downloadThroughput: profile.downloadBytesPerSecond,
    uploadThroughput: profile.uploadBytesPerSecond
  });
  await session.send("Emulation.setCPUThrottlingRate", { rate: profile.cpuSlowdown });
  return session;
}

/** Only first-party traffic counts toward these budgets; ads and other hosts are aborted. */
async function blockThirdParty(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

function largestContentfulPaint(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          resolve(entries[entries.length - 1]?.startTime ?? Number.POSITIVE_INFINITY);
        }).observe({ type: "largest-contentful-paint", buffered: true });
        setTimeout(() => resolve(Number.POSITIVE_INFINITY), 5000);
      })
  );
}

function firstContentfulPaint(page: Page): Promise<number> {
  return page.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? Number.POSITIVE_INFINITY);
}

function cumulativeLayoutShift(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { readonly value?: number; readonly hadRecentInput?: boolean };
            if (shift.hadRecentInput !== true) total += shift.value ?? 0;
          }
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve(total), 200);
      })
  );
}

test.describe("LCP, first paint and CLS budgets (S06)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");
  test.describe.configure({ timeout: 60_000 });

  test("'/' LCP ≤ 2.0 s on Slow 4G", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await blockThirdParty(page);
    await throttle(page, SLOW_4G);
    await page.goto("/", { waitUntil: "load" });
    await page.waitForTimeout(1000);
    const lcp = await largestContentfulPaint(page);
    console.info(`[lcp-budget] '/' on ${SLOW_4G.name}: ${Math.round(lcp)} ms (max ${LCP_BUDGET_MS} ms)`);
    expect(lcp).toBeLessThanOrEqual(LCP_BUDGET_MS);
  });

  test("deep-link first paint ≤ 1.0 s on Fast 4G, and that paint is the number bar with '조회하고 있어요'", async ({ page, request }) => {
    const html = await (await request.get(`/${FAKE.domestic}`)).text();
    expect(html).toContain('data-number-bar="true"');
    expect(html).toContain(lookup.copy.title);
    await page.setViewportSize({ width: 375, height: 812 });
    await blockThirdParty(page);
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 20_000 });
    await throttle(page, FAST_4G);
    await page.goto(`/${FAKE.domestic}`, { waitUntil: "load" });
    const fcp = await firstContentfulPaint(page);
    console.info(`[fcp-budget] deep link on ${FAST_4G.name}: ${Math.round(fcp)} ms (max ${FCP_BUDGET_MS} ms)`);
    expect(fcp).toBeLessThanOrEqual(FCP_BUDGET_MS);
    await expect(page.locator('[data-number-bar="true"]')).toContainText(FAKE.domestic);
  });

  test("CLS ≤ 0.05 on '/' and while a deep link loads", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await blockThirdParty(page);
    await page.goto("/");
    await page.waitForTimeout(3000);
    const home = await cumulativeLayoutShift(page);
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 20_000 });
    await page.goto(`/${FAKE.domestic}`);
    await page.waitForTimeout(3500); // crosses the 0.4 s and 3 s stage changes
    const deepLink = await cumulativeLayoutShift(page);
    console.info(`[cls-budget] '/': ${home.toFixed(3)}, deep link while loading: ${deepLink.toFixed(3)} (max ${CLS_BUDGET})`);
    expect(home).toBeLessThanOrEqual(CLS_BUDGET);
    expect(deepLink).toBeLessThanOrEqual(CLS_BUDGET);
  });
});
