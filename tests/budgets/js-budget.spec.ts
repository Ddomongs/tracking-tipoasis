import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { gzipSync } from "node:zlib";
import { mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";

/**
 * Spec §12 JS budgets: module scripts only, each file compressed with gzip level 9, 1 KB = 1024 B. The basis matches the
 * Phase 1 measurement (217,057 B on '/' before the renewal; platform floor 138,783 B on '/privacy').
 */
const KB = 1024;
const HOME_TARGET_BYTES = 165 * KB;
const HOME_FAIL_BYTES = 175 * KB;
const HOME_WARN_BYTES = 145 * KB;
const APP_MAX_BYTES = 25 * KB;
const RESULT_CHUNK_MAX_BYTES = 30 * KB;
const DEEP_LINK_MAX_BYTES = 195 * KB;
const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
/** Text that only lazy code contains: zod (response parsing, loaded by fetchTrack) and the result view (data-primary-end). */
const LAZY_ONLY_SIGNATURES: readonly string[] = ["ZodError", "data-primary-end"];

interface ScriptTag {
  readonly src: string;
  readonly noModule: boolean;
}

interface Measured {
  readonly path: string;
  readonly raw: Buffer;
  readonly gzip: number;
}

function scriptTags(html: string): readonly ScriptTag[] {
  return Array.from(html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"[^>]*>/g), (match) => ({
    src: match[1].replace(/&amp;/g, "&"),
    noModule: /\snomodule\b/i.test(match[0])
  }));
}

function pathOf(url: string): string {
  return new URL(url, "http://127.0.0.1").pathname;
}

const measured = new Map<string, Measured>();

async function measure(request: APIRequestContext, url: string): Promise<Measured> {
  const key = pathOf(url);
  const known = measured.get(key);
  if (known !== undefined) return known;
  const response = await request.get(key);
  expect(response.status(), key).toBe(200);
  const raw = await response.body();
  const item: Measured = { path: key, raw, gzip: gzipSync(raw, { level: 9 }).byteLength };
  measured.set(key, item);
  return item;
}

/** The module scripts the server HTML of `route` names (nomodule polyfills excluded). */
async function initialScripts(request: APIRequestContext, route: string): Promise<readonly Measured[]> {
  const response = await request.get(route);
  expect(response.status(), route).toBe(200);
  const tags = scriptTags(await response.text()).filter((tag) => !tag.noModule);
  return Promise.all(tags.map((tag) => measure(request, tag.src)));
}

function total(items: readonly Measured[]): number {
  return items.reduce((sum, item) => sum + item.gzip, 0);
}

function describeFiles(items: readonly Measured[]): string {
  return items.map((item) => `${item.path.split("/").pop() ?? item.path} ${item.gzip} B`).join(", ");
}

function kb(bytes: number): string {
  return `${(bytes / KB).toFixed(1)} KB`;
}

/** First-party script paths the page requests from now on. */
function recordScripts(page: Page): () => readonly string[] {
  const seen = new Set<string>();
  page.on("request", (request) => {
    if (request.resourceType() !== "script") return;
    const url = new URL(request.url());
    if (url.pathname.startsWith("/_next/")) seen.add(url.pathname);
  });
  return () => [...seen];
}

async function blockOtherHosts(page: Page): Promise<void> {
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

test.describe("JS budgets (S07)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");

  test("'/' initial JavaScript stays under 175 KB with the app part at most 25 KB and no lazy-only code", async ({ request }) => {
    const home = await initialScripts(request, "/");
    const platform = await initialScripts(request, "/privacy");
    const platformPaths = new Set(platform.map((item) => item.path));
    const app = home.filter((item) => !platformPaths.has(item.path));
    const homeBytes = total(home);
    const appBytes = total(app);
    console.info(`[js-budget] platform floor ('/privacy'): ${total(platform)} B in ${platform.length} files`);
    console.info(`[js-budget] '/' initial: ${homeBytes} B = ${kb(homeBytes)} (target 165 KB, warn from 145 KB, fail above 175 KB)`);
    console.info(`[js-budget] '/' app: ${appBytes} B = ${kb(appBytes)} (max 25 KB) — ${describeFiles(app)}`);
    if (homeBytes >= HOME_WARN_BYTES) {
      test.info().annotations.push({ type: "warning", description: `'/' initial ${kb(homeBytes)} is at or above 145 KB` });
    }
    if (homeBytes > HOME_TARGET_BYTES) {
      test.info().annotations.push({ type: "warning", description: `'/' initial ${kb(homeBytes)} is above the 165 KB target` });
    }
    const lazyOnly = home.flatMap((item) =>
      LAZY_ONLY_SIGNATURES.filter((signature) => item.raw.includes(signature)).map((signature) => `${item.path}: ${signature}`)
    );
    expect(lazyOnly).toEqual([]);
    expect(homeBytes).toBeLessThanOrEqual(HOME_FAIL_BYTES);
    expect(appBytes).toBeLessThanOrEqual(APP_MAX_BYTES);
  });

  test("the lazy result chunk is at most 30 KB and arrives only when a lookup is near", async ({ page, request }) => {
    await blockOtherHosts(page);
    const scripts = recordScripts(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const before = new Set(scripts());
    const early = await Promise.all([...before].map((item) => measure(request, item)));
    expect(early.filter((item) => item.raw.includes("data-primary-end")).map((item) => item.path)).toEqual([]);
    const resultResponse = page.waitForResponse(
      async (response) => response.request().resourceType() === "script" && (await response.body()).includes("data-primary-end")
    );
    await page.getByLabel(INPUT_LABEL, { exact: true }).focus();
    await resultResponse;
    // Sibling chunks of the same dynamic import are requested together with it; give their requests a moment to register.
    await page.waitForTimeout(300);
    const chunk = await Promise.all(scripts().filter((item) => !before.has(item)).map((item) => measure(request, item)));
    const bytes = total(chunk);
    console.info(`[js-budget] result chunk: ${bytes} B = ${kb(bytes)} in ${chunk.length} file(s) (max 30 KB) — ${describeFiles(chunk)}`);
    expect(chunk.some((item) => item.raw.includes("data-primary-end"))).toBe(true);
    expect(bytes).toBeLessThanOrEqual(RESULT_CHUNK_MAX_BYTES);
  });

  test("'/{번호}' loads at most 195 KB of JavaScript through a settled result", async ({ page, request }) => {
    await blockOtherHosts(page);
    const scripts = recordScripts(page);
    const data = trackData("inTransit");
    await mockTrack(page, data);
    await page.goto(`/${data.trackingNumber}`);
    await expect(page.locator("[data-result-view]")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const initial = await initialScripts(request, `/${data.trackingNumber}`);
    const paths = new Set<string>([...initial.map((item) => item.path), ...scripts()]);
    const loaded = await Promise.all([...paths].map((item) => measure(request, item)));
    const bytes = total(loaded);
    console.info(`[js-budget] '/{번호}' through the result: ${bytes} B = ${kb(bytes)} in ${loaded.length} files (max 195 KB)`);
    expect(bytes).toBeLessThanOrEqual(DEEP_LINK_MAX_BYTES);
  });
});
