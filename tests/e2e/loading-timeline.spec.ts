import { expect, test } from "@playwright/test";
import { lookup } from "@/config/site.config";
import { carrierOfficialUrl } from "@/lib/tracking/carriers";
import { fillSlots } from "@/lib/tracking/template";
import { FAKE, trackData } from "../fixtures/tracking-fixtures";
import {
  APP_LIVE_REGIONS,
  CARRIER_LABEL,
  INPUT_LABEL,
  RESULT_SLOT_CONTENT,
  blockThirdParty,
  holdTrack,
  liveRegion,
  lookUp,
  openPaused,
  statusSlot,
  submitButton
} from "../support/status-slot";

const [LONG_WAIT_MS, VERY_LONG_WAIT_MS] = lookup.stageMs;
/** GAP2-01: a no-result answer took up to 29.19 s before the server fix; after R4 the slow-but-valid case stays inside the timeout. */
const SLOW_VALID_MS = Math.min(29_190, lookup.timeoutMs - 4_000);
/** LiveAnnouncer empties the region first and writes 60 ms later. */
const ANNOUNCE_MS = 100;
/** Negative checks: time for a wrongly applied late answer to render. */
const SETTLE_MS = 500;

const elapsedText = (elapsedMs: number): string => fillSlots(lookup.copy.elapsed, { seconds: String(Math.ceil(elapsedMs / 1000)) });

test.beforeEach(async ({ page }) => {
  await blockThirdParty(page);
});

test("one polite live region is in the server HTML and stays the only one", async ({ page, request }) => {
  const html = await (await request.get("/")).text();
  expect(html.match(/aria-live=/g) ?? []).toHaveLength(1);
  expect(html).toContain('data-live-region="polite"');
  await page.goto("/");
  const regions = page.locator(APP_LIVE_REGIONS);
  await expect(regions).toHaveCount(1);
  await expect(regions).toHaveAttribute("role", "status");
  await expect(regions).toHaveAttribute("aria-atomic", "true");
  await expect(regions).toHaveText("");
});

test("0–0.4 s: only the submit label changes; nothing is disabled and the form says it is busy", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await expect(submitButton(page)).toHaveText(lookup.copy.submitting);
  await expect(submitButton(page)).toBeEnabled();
  await expect(page.getByLabel(INPUT_LABEL, { exact: true })).toBeEnabled();
  await expect(page.getByRole("combobox", { name: CARRIER_LABEL })).toBeEnabled();
  await expect(page.locator('#tracking-panel form[aria-busy="true"]')).toHaveCount(1);
  await page.clock.runFor(lookup.skeletonDelayMs - 1);
  await expect(page.locator(RESULT_SLOT_CONTENT)).toHaveCount(0);
});

test("0.4–3 s: the loading card under the form with the number and a static skeleton; '조회를 시작했어요' is read", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await page.clock.runFor(lookup.skeletonDelayMs);
  await expect(statusSlot(page)).toHaveAttribute("data-view-state", "loading");
  const card = statusSlot(page).locator("[data-loading-stage]");
  await expect(card).toHaveAttribute("data-loading-stage", "short");
  await expect(card.getByRole("heading", { level: 2 })).toHaveText(lookup.copy.title);
  await expect(card.getByText(lookup.copy.body)).toBeVisible();
  // S07: the number bar above the result area is the one place for the number and the carrier (RULE-MAP S07-12).
  await expect(page.locator("[data-number-bar]")).toContainText(FAKE.domestic);
  await expect(page.locator("[data-number-bar]")).toContainText(lookup.copy.carrierAuto);
  await expect(card.locator('[data-loading-skeleton="journey"]')).toBeVisible();
  await expect(card.getByRole("button", { name: lookup.copy.cancel })).toHaveCount(0);
  await page.clock.runFor(ANNOUNCE_MS);
  await expect(liveRegion(page)).toHaveText(lookup.copy.started);
  await expect(page.locator(APP_LIVE_REGIONS)).toHaveCount(1);
});

test("3 s, 5 s and 8 s: [조회 취소], the spinner stops, the very-long sentence is read, elapsed time in steps", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  const card = statusSlot(page).locator("[data-loading-stage]");
  const spinner = card.locator("[data-spinner]");

  await page.clock.runFor(LONG_WAIT_MS);
  await expect(card).toHaveAttribute("data-loading-stage", "long");
  await expect(card.getByText(lookup.copy.longWait)).toBeVisible();
  await expect(card.getByText(lookup.copy.longWait)).not.toContainText("번호 문제는 아니에요");
  await expect(card.getByRole("button", { name: lookup.copy.cancel })).toBeVisible();
  await expect(spinner).toHaveCount(1);

  await page.clock.runFor(lookup.spinnerStopMs - LONG_WAIT_MS);
  await expect(spinner).toHaveCount(0);

  await page.clock.runFor(VERY_LONG_WAIT_MS - lookup.spinnerStopMs);
  await expect(card).toHaveAttribute("data-loading-stage", "veryLong");
  await expect(card.getByText(lookup.copy.veryLongWait)).toBeVisible();
  await expect(card.getByText(elapsedText(VERY_LONG_WAIT_MS))).toBeVisible();
  await page.clock.runFor(ANNOUNCE_MS);
  await expect(liveRegion(page)).toHaveText(lookup.copy.veryLongWait);

  await page.clock.runFor(lookup.elapsedStepSeconds * 1000);
  await expect(card.getByText(elapsedText(VERY_LONG_WAIT_MS + lookup.elapsedStepSeconds * 1000))).toBeVisible();
  await expect(spinner).toHaveCount(0);
  await expect(liveRegion(page)).toHaveText(lookup.copy.veryLongWait);
});

test("reduced motion: the spinner never turns", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await page.clock.runFor(lookup.skeletonDelayMs);
  await expect(statusSlot(page).locator("[data-spinner]")).toHaveCount(0);
});

test("a chosen carrier: '택배사 공식 조회로 먼저 보기' appears with the very-long sentence", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic, "CJ");
  await held.waitForRequests(1);
  expect(held.bodies()).toEqual([{ trackingNumber: FAKE.domestic, carrierCode: "CJ" }]);
  const official = statusSlot(page).getByRole("link", { name: `${lookup.copy.carrierOfficialFirst} 새 창으로 열기` });
  await page.clock.runFor(VERY_LONG_WAIT_MS - 1);
  await expect(official).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(official).toHaveAttribute("href", carrierOfficialUrl("CJ", FAKE.domestic) ?? "");
  await expect(official).toHaveAttribute("target", "_blank");
});

test("[조회 취소] keeps the number, returns to the form and ignores the late answer", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await page.clock.runFor(LONG_WAIT_MS);
  await statusSlot(page).getByRole("button", { name: lookup.copy.cancel }).click();
  await expect(page.locator(RESULT_SLOT_CONTENT)).toHaveCount(0);
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await expect(input).toHaveValue(FAKE.domestic);
  await expect(input).toBeFocused();
  await expect(submitButton(page)).toHaveText(lookup.copy.submit);
  await held.release(0, trackData("pending"));
  await page.waitForTimeout(SETTLE_MS);
  await expect(page.locator(RESULT_SLOT_CONTENT)).toHaveCount(0);
  await expect(statusSlot(page).locator('[data-guide-key="pending"]')).toHaveCount(0);
});

test("a new submit aborts the previous request and ignores its late answer", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await lookUp(page, FAKE.hbl);
  await held.waitForRequests(2);
  expect(held.bodies()).toEqual([
    { trackingNumber: FAKE.domestic, carrierCode: "AUTO" },
    { trackingNumber: FAKE.hbl, carrierCode: "AUTO" }
  ]);
  await held.release(1, trackData("inTransit"));
  await expect(statusSlot(page).locator('[data-guide-key="inTransit"]')).toBeVisible();
  await held.release(0, trackData("pending"));
  await page.waitForTimeout(SETTLE_MS);
  await expect(statusSlot(page).locator('[data-guide-key="pending"]')).toHaveCount(0);
  await expect(statusSlot(page).locator('[data-guide-key="inTransit"]')).toBeVisible();
});

test("a slow but valid answer (29.19 s before the server fix) still shows its result", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await page.clock.runFor(SLOW_VALID_MS);
  await expect(statusSlot(page).locator("[data-loading-stage]")).toHaveAttribute("data-loading-stage", "veryLong");
  await held.release(0, trackData("pending"));
  await expect(statusSlot(page).locator('[data-guide-key="pending"]')).toBeVisible();
  await expect(page.locator('[data-cta-state="error"]')).toHaveCount(0);
});
