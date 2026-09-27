import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const AD_SCRIPT = 'script[src*="adsbygoogle.js"]';
/** Ad and analytics hosts. Every request to them is recorded and aborted, so tests never reach the network. */
const AD_REQUEST =
  /^https:\/\/([a-z0-9-]+\.)*(googlesyndication\.com|doubleclick\.net|adtrafficquality\.google|google-analytics\.com|googletagmanager\.com)\//;
const AD_SOURCE_MARKERS = /adsbygoogle|ADSENSE_|AdLoader|pagead2/;

async function recordAdRequests(page: Page): Promise<string[]> {
  const hosts: string[] = [];
  await page.route(AD_REQUEST, async (route) => {
    hosts.push(new URL(route.request().url()).hostname);
    await route.abort();
  });
  return hosts;
}

/** Waits past window.load plus an idle period: the moment next/script's lazyOnload inserts its script. */
async function afterLazyScripts(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestIdleCallback(() => resolve(), { timeout: 2000 });
      })
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 500);
      })
  );
}

function sourceFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFilesUnder(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

test("the root layout and the internal route group carry no ad loader", () => {
  const internalDir = path.join(REPO_ROOT, "app", "(internal)");
  expect(existsSync(path.join(internalDir, "layout.tsx")), "app/(internal)/layout.tsx exists").toBe(true);
  for (const file of [path.join(REPO_ROOT, "app", "layout.tsx"), ...sourceFilesUnder(internalDir)]) {
    expect(readFileSync(file, "utf8"), path.relative(REPO_ROOT, file)).not.toMatch(AD_SOURCE_MARKERS);
  }
});

test.describe("internal pages", () => {
  test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

  test("the CS helper loads no ad script, sends no ad request and asks robots not to index it", async ({ page }) => {
    const adHosts = await recordAdRequests(page);
    await page.goto("/internal/cs-helper");
    await afterLazyScripts(page);
    await expect(page.locator(AD_SCRIPT)).toHaveCount(0);
    expect(adHosts).toEqual([]);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  });
});

test("public pages still load the AdSense loader (control)", async ({ page }) => {
  // S08 (approval 7): on '/' the loader waits for an allowed result or a scroll down to the store showcase.
  // A phone-sized window makes sure the home is taller than the viewport, so the scroll below is a real one.
  await recordAdRequests(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.locator("[data-store-showcase]").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 1));
  await expect(page.locator(AD_SCRIPT)).toHaveCount(1);
});
