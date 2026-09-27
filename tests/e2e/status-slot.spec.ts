import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { LEGACY_RESULT_COPY, deriveStatusView } from "@/components/status-slot/status-view";
import { resultCopy, siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { LookupEntry, TrackingViewModel } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import {
  APP_LIVE_REGIONS,
  CARRIER_LABEL,
  INPUT_LABEL,
  blockThirdParty,
  holdTrack,
  liveRegion,
  lookUp,
  statusSlot
} from "../support/status-slot";

/** Two days after the worry date of the customs-waiting fixture (9/28, Mon): the same state is now overdue (spec §6). */
const OVERDUE_NOW = new Date("2026-09-30T10:00:00+09:00");

function expectedResult(data: TrackResponseData, now: Date = FIXTURE_NOW, entry: LookupEntry = "manual"): TrackingViewModel {
  return deriveStatusView({ kind: "success", request: { number: data.trackingNumber, carrier: "AUTO", entry }, data }, now);
}

async function showResult(page: Page, data: TrackResponseData, now: Date): Promise<void> {
  await page.clock.setFixedTime(now);
  await mockTrack(page, data);
  await page.goto("/");
  await lookUp(page, data.trackingNumber);
  await expect(statusSlot(page)).toHaveAttribute("data-status-slot", "settled");
}

test.beforeEach(async ({ page }) => {
  await blockThirdParty(page);
});

test("a manual result fills the slot under the form: status card, spine and estimate, then 지금 할 일", async ({ page }) => {
  const data = trackData("customsWaiting");
  const view = expectedResult(data);
  await showResult(page, data, FIXTURE_NOW);
  const slot = statusSlot(page);
  const card = slot.locator("[data-guide-key]");
  await expect(card).toHaveAttribute("data-guide-key", view.guideKey);
  await expect(card).toHaveAttribute("data-overdue", "false");
  await expect(card).toHaveAttribute("data-tone", view.tone);
  const heading = card.getByRole("heading", { level: 2 });
  await expect(heading).toHaveText(view.title);
  await expect(heading).toBeFocused();
  await expect(card.getByRole("list", { name: "배송 여정 4구간" }).locator('[aria-current="step"]')).toHaveCount(
    view.spine.current === null ? 0 : 1
  );
  await expect(card.locator("[data-eta-kind]")).toHaveAttribute("data-eta-kind", view.eta.kind);
  await expect(slot.locator("[data-cta-state]")).toHaveAttribute("data-cta-state", view.ctaState);
  const cardBeforeCta = await page.evaluate(() => {
    const status = document.querySelector("#tracking-panel [data-status-slot] [data-guide-key]");
    const cta = document.querySelector("#tracking-panel [data-status-slot] [data-cta-state]");
    return status !== null && cta !== null && (status.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  expect(cardBeforeCta).toBe(true);
  await expect(slot.getByRole("alert")).toHaveCount(0);
  await expect(liveRegion(page)).toHaveText(view.liveMessage);
  await expect(page.locator(APP_LIVE_REGIONS)).toHaveCount(1);
});

test("normal waiting: no filled button, the worry date is bound to the 톡톡 link, the return link is there", async ({ page }) => {
  const data = trackData("customsWaiting");
  const view = expectedResult(data);
  await showResult(page, data, FIXTURE_NOW);
  const slot = statusSlot(page);
  await expect(slot.locator('[data-action-weight="primary"]')).toHaveCount(0);
  const worry = slot.locator("[data-worry-line]");
  await expect(worry).toContainText(view.nextAction.worry?.text ?? "");
  await expect(worry.getByRole("link", { name: `${siteConfig.channels.talk.labels.cta} 새 창으로 열기` })).toHaveAttribute(
    "href",
    siteConfig.channels.talk.url
  );
  await expect(slot.getByRole("button", { name: resultCopy.actionReturnLink })).toBeVisible();
});

test("overdue: the same state turns to '확인 필요' with copy-and-talk first and no recommendations", async ({ page }) => {
  const data = trackData("customsWaiting");
  const view = expectedResult(data, OVERDUE_NOW);
  expect(view.overdue).toBe(true);
  await showResult(page, data, OVERDUE_NOW);
  const slot = statusSlot(page);
  const card = slot.locator("[data-guide-key]");
  await expect(card).toHaveAttribute("data-overdue", "true");
  await expect(card).toHaveAttribute("data-tone", "attention");
  await expect(card.getByRole("heading", { level: 2 })).toHaveText(view.title);
  const primary = slot.locator('[data-action-weight="primary"]');
  await expect(primary).toHaveCount(1);
  await expect(primary).toHaveAttribute("data-action-kind", "copyAndTalk");
  await expect(slot.locator("[data-inquiry-preview]")).toHaveText(view.inquiryCopy ?? "");
  await expect(page.locator("[data-recommended-products]")).toHaveCount(0);
  await expect(page.locator('a[rel~="sponsored"]')).toHaveCount(0);
});

test.describe("copying the inquiry", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("one click copies the inquiry and opens 톡톡 in a new tab", async ({ page }) => {
    const data = trackData("customsWaiting");
    const view = expectedResult(data, OVERDUE_NOW);
    await showResult(page, data, OVERDUE_NOW);
    const link = statusSlot(page).locator('[data-action-kind="copyAndTalk"]');
    await expect(link).toHaveAttribute("href", siteConfig.channels.talk.url);
    await expect(link).toHaveAttribute("target", "_blank");
    const popup = page.waitForEvent("popup");
    await link.click();
    await (await popup).close();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(view.inquiryCopy ?? "");
  });
});

test("blocked clipboard shows the inquiry in a read-only, pre-selected box", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (): Promise<void> => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError")) }
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: (): boolean => false });
  });
  const data = trackData("customsWaiting");
  const view = expectedResult(data, OVERDUE_NOW);
  await showResult(page, data, OVERDUE_NOW);
  const popup = page.waitForEvent("popup");
  await statusSlot(page).locator('[data-action-kind="copyAndTalk"]').click();
  await (await popup).close();
  const box = statusSlot(page).locator('textarea[data-copy-fallback="true"]');
  await expect(box).toHaveValue(view.inquiryCopy ?? "");
  await expect(box).toHaveAttribute("readonly", "");
  await expect
    .poll(() => box.evaluate((element) => (element instanceof HTMLTextAreaElement ? element.selectionEnd - element.selectionStart : -1)))
    .toBe((view.inquiryCopy ?? "").length);
});

test("deep link: the result takes focus when the customer has not touched the page", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const data = trackData("inTransit");
  await mockTrack(page, data, { delayMs: 300 });
  await page.goto(`/${data.trackingNumber}`);
  const heading = statusSlot(page).locator("[data-guide-key]").getByRole("heading", { level: 2 });
  await expect(heading).toHaveText(expectedResult(data, FIXTURE_NOW, "deepLink").title);
  await expect(heading).toBeFocused();
});

test("deep link: focus stays where the customer is once they interacted; the live region still reads the result", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const held = await holdTrack(page);
  const data = trackData("inTransit");
  await page.goto(`/${data.trackingNumber}`);
  await held.waitForRequests(1);
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await input.click();
  await held.release(0, data);
  await expect(liveRegion(page)).toHaveText(expectedResult(data, FIXTURE_NOW, "deepLink").liveMessage);
  await expect(input).toBeFocused();
});

test("carrier chips look the same number up again with the chosen carrier", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const bodies: unknown[] = [];
  await mockTrack(page, trackData("ambiguous"), { onRequest: (body) => bodies.push(body) });
  await page.goto("/");
  await lookUp(page, FAKE.domestic);
  const chips = statusSlot(page).getByRole("group", { name: "택배사 선택" });
  await expect(chips.getByRole("button")).toHaveCount(5);
  await chips.getByRole("button", { name: "CJ대한통운" }).click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]).toEqual({ trackingNumber: FAKE.domestic, carrierCode: "CJ" });
  await expect(page.getByRole("combobox", { name: CARRIER_LABEL })).toHaveValue("CJ");
});

test("delivered: '받지 못하셨나요?' opens the pickup help inside 지금 할 일", async ({ page }) => {
  await showResult(page, trackData("delivered"), FIXTURE_NOW);
  const help = statusSlot(page).locator('[data-cta-state="delivered"] details', { hasText: resultCopy.actionUndelivered });
  await help.locator("summary").click();
  const lines = siteConfig.help.find((item) => item.id === "undelivered")?.body ?? [];
  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) await expect(help.getByText(line)).toBeVisible();
});

test("the details below the slot are one result region; the legacy summary is gone", async ({ page }) => {
  await showResult(page, trackData("inTransit"), FIXTURE_NOW);
  const region = page.getByRole("region", { name: "배송 조회 결과" });
  await expect(region).toHaveAttribute("data-ad-exclude", "true");
  await expect(region.getByRole("heading", { name: "국내 배송 진행 상황" })).toBeVisible();
  await expect(page.locator('[data-tracking-result-summary="true"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: expectedResult(trackData("inTransit")).title })).toHaveCount(1);
});

test("approval 2: results show the configured wording, with no pre-renewal overlay", async ({ page }) => {
  const data = trackData("customsWaiting");
  const configured = deriveTrackingView(
    { kind: "success", request: { number: data.trackingNumber, carrier: "AUTO", entry: "manual" }, data },
    FIXTURE_NOW,
    siteConfig
  );
  expect(configured.title).not.toBe(LEGACY_RESULT_COPY.customsWaitingTitle);
  await showResult(page, data, FIXTURE_NOW);
  const slot = statusSlot(page);
  await expect(slot.locator("[data-guide-key]").getByRole("heading", { level: 2 })).toHaveText(configured.title);
  await expect(slot.getByText(configured.nextAction.sentence, { exact: true })).toBeVisible();
  await expect(slot.getByText(LEGACY_RESULT_COPY.sentences.customsWaiting, { exact: true })).toHaveCount(0);
  await expect(liveRegion(page)).toHaveText(configured.liveMessage);
});
