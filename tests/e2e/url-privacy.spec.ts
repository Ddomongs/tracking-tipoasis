import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { AD_TIMING_POLICY } from "@/lib/ads/ad-gate";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { ADSENSE_LOADER_URL } from "@/lib/site";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { assertNoTrackingValues, captureThirdParty, waitForIdle, watchAdLoader } from "../support/network-capture";
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
