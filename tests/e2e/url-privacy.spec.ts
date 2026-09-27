import { chromium, expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { AD_TIMING_POLICY } from "@/lib/ads/ad-gate";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { ADSENSE_LOADER_URL } from "@/lib/site";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import {
  assertNoTrackingValues,
  captureThirdParty,
  recordLookups,
  waitForIdle,
  watchAdLoader
} from "../support/network-capture";
import type { AdLoaderInsertion, AdLoaderWatch } from "../support/network-capture";

const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const RESULT_READY = { name: "다시 볼 링크 복사" } as const;

type Entry = "home" | "deepLink";

/** Scenario-level mirror of the gate, evaluated after an allowed (inTransit) result has settled on screen. */
function loaderExpected(entry: Entry): boolean {
  switch (AD_TIMING_POLICY) {
    case "neverOnNumberRoutes":
      return entry === "home";
    case "afterScrub":
    case "afterAllowedResult":
      return true;
  }
}

function inTransit(number: string): TrackResponseData {
  return trackData("inTransit", { trackingNumber: number });
}

async function expectPath(page: Page, expected: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => `${location.pathname}${location.search}${location.hash}`), { timeout: 10_000 })
    .toBe(expected);
}

async function submitFromHome(page: Page, number: string): Promise<void> {
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await input.fill(number);
  await input.press("Enter");
  await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
}

async function expectLoaderInCurrentDocument(page: Page, loader: AdLoaderWatch, entry: Entry): Promise<void> {
  const documentId = await loader.currentDocumentId();
  const inDocument = (): number => loader.insertions().filter((insertion) => insertion.documentId === documentId).length;
  if (loaderExpected(entry)) {
    await expect.poll(inDocument, { timeout: 10_000 }).toBe(1);
  } else {
    await waitForIdle(page);
    expect(inDocument()).toBe(0);
  }
}

function expectInsertionsSafe(insertions: readonly AdLoaderInsertion[]): void {
  const perDocument = new Map<string, number>();
  for (const insertion of insertions) {
    perDocument.set(insertion.documentId, (perDocument.get(insertion.documentId) ?? 0) + 1);
    expect(insertion.hasPageUrlAttribute, "data-page-url is forbidden (GAP1-03)").toBe(false);
    expect(containsTrackingLikeValue(insertion.href), "loader inserted while the URL carried a number").toBe(false);
  }
  for (const count of perDocument.values()) expect(count, "at most one loader per document").toBe(1);
}

const RSC_REQUEST_LIMIT = 30;

/** Samples location every 5 ms (and right after each popstate): records any moment where the loader is present
 *  while path, query or hash carries a tracking-like value. */
async function installUrlSampler(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window.top !== window) return;
    const pattern = /\d(?:[ -]?\d){9,}|(?:^|[^A-Za-z0-9])[A-Za-z]{3,4}\d{8,16}(?![0-9])/;
    const violations: string[] = [];
    const sample = (): void => {
      if (document.querySelector('script[data-ad-loader="adsense"]') === null) return;
      let target = `${location.pathname}${location.search}${location.hash}`;
      try {
        target = decodeURIComponent(target);
      } catch {
        // keep the raw value
      }
      if (pattern.test(target)) violations.push(location.href);
    };
    window.setInterval(sample, 5);
    window.addEventListener("popstate", () => window.setTimeout(sample, 0));
    Object.defineProperty(window, "__ttUrlViolations", { value: violations });
  });
}

async function urlViolations(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__ttUrlViolations");
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
  });
}

function pathOf(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

test.describe("SSR shell and home", () => {
  test("SSR HTML of '/', number routes and /privacy carries no ad loader", async ({ request }) => {
    for (const path of ["/", `/${FAKE.domestic}`, `/${FAKE.hbl}`, "/privacy"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      const html = await response.text();
      expect(html, path).not.toContain("adsbygoogle");
      expect(html, path).not.toContain("googlesyndication");
    }
  });

  test("home: one loader at '/' after load, and third-party traffic carries no tracking value", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    await mockTrack(page, inTransit(FAKE.domestic));
    await page.goto("/");
    if (AD_TIMING_POLICY !== "afterAllowedResult") await expectLoaderInCurrentDocument(page, loader, "home");
    await submitFromHome(page, FAKE.domestic);
    await expectLoaderInCurrentDocument(page, loader, "home");
    expect(loader.insertions().map((insertion) => insertion.pathname)).toEqual(["/"]);
    await expect.poll(() => capture.requests().some((request) => request.url === ADSENSE_LOADER_URL)).toBe(true);
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("/privacy as the first document gets the loader at /privacy", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    await page.goto("/privacy");
    if (AD_TIMING_POLICY !== "afterAllowedResult") {
      await expect.poll(() => loader.insertions().length, { timeout: 10_000 }).toBe(1);
      expect(loader.insertions()[0]?.pathname).toBe("/privacy");
    }
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });
});

test.describe("deep links (candidate B)", () => {
  test("the lookup starts, the URL becomes '/', and the loader follows the policy only at '/'", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    const lookups = recordLookups();
    await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    expect(lookups.numbers()).toEqual([FAKE.domestic]);
    await expectLoaderInCurrentDocument(page, loader, "deepLink");
    for (const insertion of loader.insertions()) expect(insertion.pathname).toBe("/");
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("query and hash leave together with the number", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    await mockTrack(page, inTransit(FAKE.hbl));
    await page.goto(`/${FAKE.hbl}?c=CJ#top`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    await expectLoaderInCurrentDocument(page, loader, "deepLink");
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("a manual lookup on '/' never puts the number into the URL", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    const navigated: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigated.push(frame.url());
    });
    await mockTrack(page, inTransit(FAKE.domestic));
    await page.goto("/");
    await submitFromHome(page, FAKE.domestic);
    await expectPath(page, "/");
    await expectLoaderInCurrentDocument(page, loader, "home");
    for (const url of navigated) expect(containsTrackingLikeValue(url), url).toBe(false);
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("if the URL cannot be changed, the loader stays out (fail-closed)", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    // Simulates a browser/router that refuses the scrub: replaceState keeps the number URL.
    await page.addInitScript(() => {
      const original = History.prototype.replaceState;
      History.prototype.replaceState = function replaceState(
        this: History,
        data: unknown,
        unused: string,
        url?: string | URL | null
      ): void {
        const onNumberPath = /^\/[^/.]+$/.test(location.pathname) && !/^\/(?:privacy|internal|api)$/.test(location.pathname);
        if (onNumberPath && url !== undefined && url !== null && String(url) === "/") {
          original.call(this, data, unused);
          return;
        }
        original.call(this, data, unused, url);
      };
    });
    await mockTrack(page, inTransit(FAKE.domestic));
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await waitForIdle(page);
    await page.waitForTimeout(1000);
    await waitForIdle(page);
    await expectPath(page, `/${FAKE.domestic}`);
    const documentId = await loader.currentDocumentId();
    expect(loader.insertions().filter((insertion) => insertion.documentId === documentId)).toEqual([]);
    expect(capture.requests()).toEqual([]);
  });
});

test.describe("navigation around the scrub", () => {
  test.describe.configure({ timeout: 90_000 });

  test("reload after the scrub restores the lookup at '/' and keeps the loader rules", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    await installUrlSampler(page);
    const lookups = recordLookups();
    await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    await expectLoaderInCurrentDocument(page, loader, "deepLink");
    expect(await urlViolations(page)).toEqual([]);

    await page.reload();
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    expect(lookups.numbers()).toEqual([FAKE.domestic, FAKE.domestic]);
    await expectLoaderInCurrentDocument(page, loader, "home");
    expect(await urlViolations(page)).toEqual([]);
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("Back from another document restores at '/' without a number in the URL", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    await installUrlSampler(page);
    const lookups = recordLookups();
    await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    await expectLoaderInCurrentDocument(page, loader, "deepLink");
    expect(await urlViolations(page)).toEqual([]);

    await page.goto("/privacy");
    await page.goBack();
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    expect(lookups.numbers()).toEqual([FAKE.domestic, FAKE.domestic]);
    await expectLoaderInCurrentDocument(page, loader, "home");
    expect(await urlViolations(page)).toEqual([]);
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("with bfcache enabled, Back to the scrubbed entry never shows a number", async ({ baseURL }) => {
    // Playwright disables bfcache by default; this browser re-enables it. Chrome may still refuse to cache the
    // deep-link document (Cache-Control: no-store), so both outcomes are checked against the same rules.
    const browser = await chromium.launch({ ignoreDefaultArgs: ["--disable-back-forward-cache"] });
    try {
      const context = await browser.newContext({ baseURL, locale: "ko-KR", timezoneId: "Asia/Seoul" });
      const page = await context.newPage();
      const capture = await captureThirdParty(page);
      const loader = await watchAdLoader(page);
      await installUrlSampler(page);
      await page.addInitScript(() => {
        window.addEventListener("pageshow", (event) => {
          if (event.persisted) document.documentElement.dataset.ttBfcache = "restored";
        });
      });
      const lookups = recordLookups();
      await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
      await page.goto(`/${FAKE.domestic}`);
      await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
      await expectPath(page, "/");
      await expectLoaderInCurrentDocument(page, loader, "deepLink");

      await page.goto("/privacy");
      await page.goBack();
      await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
      await expectPath(page, "/");
      const fromCache = await page.evaluate(() => document.documentElement.dataset.ttBfcache === "restored");
      test.info().annotations.push({ type: "bfcache", description: fromCache ? "restored from bfcache" : "loaded again" });
      expect(lookups.numbers()).toHaveLength(fromCache ? 1 : 2);
      await expectLoaderInCurrentDocument(page, loader, fromCache ? "deepLink" : "home");
      expect(await urlViolations(page)).toEqual([]);
      expectInsertionsSafe(loader.insertions());
      assertNoTrackingValues(capture.requests());
    } finally {
      await browser.close();
    }
  });

  test("a second deep link in the same tab: Back restores the tab's last lookup, never a number URL", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    await installUrlSampler(page);
    const lookups = recordLookups();
    await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    await expectLoaderInCurrentDocument(page, loader, "deepLink");
    expect(await urlViolations(page)).toEqual([]);

    await page.goto(`/${FAKE.hbl}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    await expectLoaderInCurrentDocument(page, loader, "deepLink");
    expect(await urlViolations(page)).toEqual([]);

    await page.goBack();
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    // One entry per tab (spec §3): the restored lookup is the tab's last one.
    expect(lookups.numbers()).toEqual([FAKE.domestic, FAKE.hbl, FAKE.hbl]);
    await expectLoaderInCurrentDocument(page, loader, "home");
    expect(await urlViolations(page)).toEqual([]);
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("a hash entry created before hydration never brings the number back into location", async ({ page }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    await installUrlSampler(page);
    await mockTrack(page, inTransit(FAKE.domestic));
    let releaseScripts: () => void = () => undefined;
    const scriptsReleased = new Promise<void>((resolve) => {
      releaseScripts = resolve;
    });
    // Hold every script so the page stays un-hydrated, like a slow network.
    await page.route(/\/_next\/static\/.+\.js(?:\?.*)?$/, async (route) => {
      await scriptsReleased;
      await route.continue();
    });
    await page.goto(`/${FAKE.domestic}`, { waitUntil: "commit" });
    await page.evaluate(() => {
      location.hash = "tracking";
    });
    await expect.poll(() => page.evaluate(() => location.hash)).toBe("#tracking");
    releaseScripts();

    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");
    await expectLoaderInCurrentDocument(page, loader, "deepLink");
    await page.goBack();
    await expectPath(page, "/");
    await page.waitForTimeout(300);
    expect(await urlViolations(page)).toEqual([]);
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });

  test("local-router regression (GAP1): links, back/forward and reload stay consistent without numbers in the URL", async ({
    page
  }) => {
    const capture = await captureThirdParty(page);
    const loader = await watchAdLoader(page);
    const lookups = recordLookups();
    await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
    const rscRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("_rsc=") || request.headers()["rsc"] === "1") rscRequests.push(request.url());
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    // 1. The deep link lands; the lookup runs and the URL becomes '/'.
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expectPath(page, "/");

    // From here on no navigation may carry a number. (Before the scrub, the router's own hydration
    // replaceState reports the deep-link URL once more; that is the URL the customer opened, not a new leak.)
    const navigated: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigated.push(frame.url());
    });

    // 2. The site's own footer link to /privacy (client navigation).
    await page.getByRole("link", { name: "개인정보처리방침" }).first().click();
    await expectPath(page, "/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("개인정보처리방침");

    // 3. Back to the tracker through a link to '/' on the privacy page.
    await page
      .getByRole("link", { name: "배송 조회로 돌아가기" })
      .or(page.getByRole("link", { name: "통관·배송 조회" }))
      .first()
      .click();
    await expectPath(page, "/");
    await expect(page.getByRole("button", RESULT_READY)).toHaveCount(0);
    await expect(page.getByLabel(INPUT_LABEL, { exact: true })).toHaveValue("");

    // 4–5. Back, back: the first entry (the scrubbed deep link) shows its result again, not the privacy page.
    await page.goBack();
    await expectPath(page, "/privacy");
    await page.goBack();
    await expectPath(page, "/");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText("개인정보처리방침");

    // 6. Forward, back.
    await page.goForward();
    await expectPath(page, "/privacy");
    await page.goBack();
    await expectPath(page, "/");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();

    // 7. Reload on the first entry: '/' restores the lookup (it used to be a number URL).
    const lookupsBeforeReload = lookups.numbers().length;
    await page.reload();
    await expectPath(page, "/");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    expect(lookups.numbers()).toHaveLength(lookupsBeforeReload + 1);

    // 8. A manual lookup from an idle home keeps '/'.
    await page.goto("/");
    await submitFromHome(page, FAKE.domesticAlt);
    await expectPath(page, "/");

    expect(lookups.numbers().slice(0, -1).every((number) => number === FAKE.domestic)).toBe(true);
    expect(lookups.numbers().at(-1)).toBe(FAKE.domesticAlt);
    expect(pageErrors).toEqual([]);
    expect(rscRequests.length, "RSC request storm (GAP1-01 saw 135–226)").toBeLessThanOrEqual(RSC_REQUEST_LIMIT);
    expect(navigated.length).toBeGreaterThan(0);
    for (const url of navigated) expect(containsTrackingLikeValue(pathOf(url)), url).toBe(false);
    expectInsertionsSafe(loader.insertions());
    assertNoTrackingValues(capture.requests());
  });
});

test.describe("same-address history entry", () => {
  test("after a manual lookup, Back returns to the lookup form at '/', Forward shows the result again", async ({ page }) => {
    const lookups = recordLookups();
    await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
    await page.goto("/");
    const lengthBefore = await page.evaluate(() => history.length);
    await submitFromHome(page, FAKE.domestic);
    await expectPath(page, "/");
    expect(await page.evaluate(() => history.length)).toBe(lengthBefore + 1);

    await page.goBack();
    await expectPath(page, "/");
    await expect(page.getByRole("button", RESULT_READY)).toHaveCount(0);
    await expect(page.getByLabel(INPUT_LABEL, { exact: true })).toBeVisible();

    await page.goForward();
    await expectPath(page, "/");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    expect(lookups.numbers()).toEqual([FAKE.domestic]);
  });
});
