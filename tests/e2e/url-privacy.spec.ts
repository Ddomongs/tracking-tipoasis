import { expect, test } from "@playwright/test";
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
