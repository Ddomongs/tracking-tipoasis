import { expect, test, type Page } from "@playwright/test";
import { disclosures, siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { FailureCause, LookupOutcome, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import {
  OCTOBER_NOW, carrierCutData, customsWaitingData, deliveredData, inTransitData, lookupUnavailableData, pendingData, staleData,
  success
} from "../fixtures/derive-scenarios";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";

/**
 * Component contracts of the result area through the internal harness (/internal/result-kit).
 * Every view model is derived here, in Node, with the shipped config — the page only renders it.
 */
test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

interface KitOptions {
  readonly frame?: "responsive" | "mobile";
  readonly readOnly?: boolean;
  readonly failureCause?: FailureCause;
  readonly withRecommendation?: boolean;
}

const at = (iso: string): Date => new Date(iso);

function viewFor(outcome: LookupOutcome, now: Date = FIXTURE_NOW): TrackingViewModel {
  return deriveTrackingView(outcome, now, siteConfig);
}

async function openKit(page: Page, width = 375, height = 812): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto("/internal/result-kit");
  await expect(page.locator('[data-result-kit="ready"]')).toBeAttached();
}

async function showView(page: Page, view: TrackingViewModel, options: KitOptions = {}): Promise<void> {
  await page.evaluate(
    ({ nextView, nextOptions }) => {
      const kit = window.__ttResultKit;
      if (kit === undefined) throw new Error("result kit is not ready");
      kit.show({ kind: "result", view: nextView, ...nextOptions });
    },
    { nextView: view, nextOptions: options }
  );
  await expect(page.locator("[data-result-view]")).toBeVisible();
}

const TALK_URL = siteConfig.channels.talk.url;
const TALK_NAME = `${siteConfig.channels.talk.labels.cta} 새 창으로 열기`;
const COPY_AND_TALK_NAME = `${siteConfig.channels.talk.labels.copyAndTalk} 새 창으로 열기`;
const RETURN_LINK_NAME = "다시 볼 링크 복사";

async function kitActions(page: Page): Promise<readonly ResultAction[]> {
  return page.evaluate(() => window.__ttResultKit?.actions() ?? []);
}

/** Popups opened by result links (carrier, 톡톡) must not reach the internet. */
async function blockOtherHosts(page: Page): Promise<void> {
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

/** Naver/Kakao in-app browser: no share sheet, the Clipboard API rejects, execCommand('copy') fails. */
async function blockClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (): Promise<void> => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError")) }
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: (): boolean => false });
  });
}

async function removeShareSheet(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
}

test.describe("status card", () => {
  test("customs waiting: chip, focusable h2, reason, one current station, the in-card notice and the ETA as the largest text", async ({ page }) => {
    const view = viewFor(success(customsWaitingData()));
    await openKit(page);
    await showView(page, view);
    const root = page.locator("[data-result-view]");
    await expect(root).toHaveAttribute("data-result-view", "settled");
    await expect(root).toHaveAttribute("data-ad-exclude", "true");
    const card = root.locator("[data-guide-key]");
    await expect(card).toHaveAttribute("data-guide-key", "customsWaiting");
    await expect(card).toHaveAttribute("data-overdue", "false");
    await expect(card).toHaveAttribute("data-tone", view.tone);
    const field = card.locator('[data-slot="status-head"]');
    await expect(field).toHaveAttribute("data-tone", view.tone);
    await expect(field.locator("[data-status-chip]")).toHaveText(view.chip ?? "");
    const title = card.getByRole("heading", { level: 2 });
    await expect(title).toHaveText(view.title);
    await expect(title).toHaveAttribute("tabindex", "-1");
    expect(await title.getAttribute("role")).toBeNull();
    await expect(field.getByText(view.reason ?? "", { exact: true })).toBeVisible();
    await expect(field.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(field.locator("[data-spine-current]")).toHaveAttribute("data-spine-current", "customs");
    await expect(field.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", view.eta.kind);
    expect(view.notice).not.toBeNull();
    await expect(field.locator('[data-notice-variant="inline"]')).toContainText(view.notice?.body ?? "");
    const sizes = await card.evaluate((element) => {
      const visual = element.querySelector("[data-eta-visual]");
      const textSizes = Array.from(element.querySelectorAll("*"))
        .filter((node) =>
          Array.from(node.childNodes).some((child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? "").trim() !== "")
        )
        .filter((node) => node.closest(".sr-only") === null)
        .map((node) => Number.parseFloat(getComputedStyle(node).fontSize));
      return { eta: visual === null ? 0 : Number.parseFloat(getComputedStyle(visual).fontSize), max: Math.max(...textSizes) };
    });
    expect(sizes.eta).toBeGreaterThanOrEqual(32);
    expect(sizes.max).toBe(sizes.eta);
  });

  test("overdue keeps the station, switches to the attention tone and marks data-overdue", async ({ page }) => {
    const view = viewFor(success(customsWaitingData()), at("2026-09-29T09:00:00+09:00"));
    expect(view.overdue).toBe(true);
    await openKit(page);
    await showView(page, view);
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card).toHaveAttribute("data-overdue", "true");
    await expect(card).toHaveAttribute("data-tone", "attention");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(view.title);
    await expect(card.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", "overdue");
  });

  test("pending: no station marker, '위치 확인 전' and the pending ETA text", async ({ page }) => {
    const view = viewFor(success(pendingData()));
    await openKit(page);
    await showView(page, view);
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card).toHaveAttribute("data-guide-key", "pending");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText("통관 정보 등록 전");
    await expect(card.locator('[aria-current="step"]')).toHaveCount(0);
    await expect(card.locator('[data-spine-part="unknown"]')).toHaveText("위치 확인 전");
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", "pendingInfo");
    await expect(card.locator("[data-eta-text]")).toHaveText("정보 등록 후 안내");
  });
});

test.describe("지금 할 일", () => {
  test("normal waiting: the sentence leads, no filled button, one 톡톡 link bound to the worry line", async ({ page }) => {
    const view = viewFor(success(customsWaitingData()));
    await openKit(page);
    await showView(page, view);
    const cta = page.locator('[data-cta-state="customsWaiting"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText(view.nextAction.heading ?? "");
    await expect(cta.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();
    await expect(cta.locator('[data-slot="button"][data-variant="primary"]')).toHaveCount(0);
    const worry = cta.locator("[data-worry-line]");
    await expect(worry).toContainText(view.nextAction.worry?.text ?? "");
    await expect(worry.getByRole("link", { name: TALK_NAME })).toBeVisible();
    await expect(cta.locator(`a[href="${TALK_URL}"]`)).toHaveCount(1);
    await expect(cta.getByRole("button", { name: RETURN_LINK_NAME })).toBeVisible();
  });

  test("pending: 번호 수정 first, then 톡톡, the disclosure before the affiliate store link, and the recheck note", async ({ page }) => {
    const view = viewFor(success(pendingData()));
    await openKit(page);
    await showView(page, view);
    const cta = page.locator('[data-cta-state="pending"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText("아직 국내 배송 정보가 없어요");
    const fix = cta.getByRole("button", { name: view.nextAction.primary?.label ?? "" });
    await expect(fix).toHaveAttribute("data-variant", "primary");
    await expect(cta.getByRole("link", { name: TALK_NAME })).toBeVisible();
    await expect(cta.locator(`a[href="${TALK_URL}"]`)).toHaveCount(1);
    const group = cta.locator('[data-affiliate-group="pending"]');
    await expect(group.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
    await expect(group.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toBeVisible();
    await expect(group.getByRole("link", { name: "쿠팡 스토어 보기 새 창으로 열기" })).toHaveAttribute("rel", /sponsored/);
    const disclosureFirst = await group.evaluate((element) => {
      const disclosure = element.querySelector("[data-affiliate-disclosure]");
      const firstLink = element.querySelector("a");
      return disclosure !== null && firstLink !== null && (disclosure.compareDocumentPosition(firstLink) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    });
    expect(disclosureFirst).toBe(true);
    await expect(cta.locator("[data-next-note]")).toHaveText(siteConfig.durations.pendingRecheck);
    await fix.click();
    expect(await kitActions(page)).toEqual([{ kind: "fixNumber" }]);
  });

  test("delivered: the two store links lead 지금 할 일 and 톡톡 follows them", async ({ page }) => {
    const view = viewFor(success(deliveredData()));
    await openKit(page);
    await showView(page, view);
    const cta = page.locator('[data-cta-state="delivered"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText("배송이 완료됐어요");
    const firstTwo = await cta
      .locator("a[href]")
      .evaluateAll((links) =>
        links.slice(0, 2).map((link) => link.closest("[data-affiliate-group]")?.getAttribute("data-affiliate-group") ?? "none")
      );
    expect(firstTwo).toEqual(["deliveredLead", "deliveredLead"]);
    await expect(cta.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
    await expect(cta.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toHaveAttribute("data-variant", "primary");
    await expect(cta.getByRole("link", { name: TALK_NAME })).toBeVisible();
    await expect(cta.getByRole("button", { name: "받지 못하셨나요?" })).toBeVisible();
    expect(view.nextAction.primary).toBeNull();
  });

  test("in transit: the carrier's live link is the primary, the driver call is a tel link, no store link", async ({ page }) => {
    await blockOtherHosts(page);
    const view = viewFor(success(inTransitData()), OCTOBER_NOW);
    await openKit(page);
    await showView(page, view);
    const cta = page.locator('[data-cta-state="inTransit"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText("배송이 진행 중이에요");
    const live = cta.getByRole("link", { name: `${view.nextAction.primary?.label ?? ""} 새 창으로 열기` });
    await expect(live).toHaveAttribute("href", view.carrier.officialUrl ?? "");
    await expect(live).toHaveAttribute("target", "_blank");
    await expect(live).toHaveAttribute("data-variant", "primary");
    await expect(cta.getByRole("link", { name: "기사님께 전화" })).toHaveAttribute("href", /^tel:/);
    await expect(cta.locator("[data-affiliate-group]")).toHaveCount(0);
    const popup = page.waitForEvent("popup");
    await live.click();
    await (await popup).close();
    expect(await kitActions(page)).toEqual([{ kind: "openedExternal", target: "carrier" }]);
  });

  test("carrier lookup delay with a known carrier: the official link is the primary and 다시 조회 reports a retry", async ({ page }) => {
    const view = viewFor(success(lookupUnavailableData("CJ")));
    await openKit(page);
    await showView(page, view);
    const cta = page.locator('[data-cta-state="lookupUnavailable"]');
    const official = cta.getByRole("link", { name: `${view.nextAction.primary?.label ?? ""} 새 창으로 열기` });
    await expect(official).toHaveAttribute("href", view.carrier.officialUrl ?? "");
    await expect(official).toHaveAttribute("data-variant", "primary");
    await cta.getByRole("button", { name: "다시 조회" }).click();
    expect(await kitActions(page)).toEqual([{ kind: "retry" }]);
  });

  test("a carrier lookup delay under customs: the cut mark and a 다시 조회 line inside the card", async ({ page }) => {
    const view = viewFor(success(carrierCutData()));
    await openKit(page);
    await showView(page, view);
    const field = page.locator('[data-result-view] [data-slot="status-head"]');
    await expect(field.locator('[data-station="domestic"]')).toHaveAttribute("data-issue", "cut");
    const line = field.locator("[data-auxiliary-line]");
    await expect(line).toContainText(view.auxiliaryLine?.text ?? "");
    await line.getByRole("button", { name: "다시 조회" }).click();
    expect(await kitActions(page)).toEqual([{ kind: "retry" }]);
  });

  test("지금 할 일 shows at most one filled control in every settled state", async ({ page }) => {
    const views = [
      viewFor(success(customsWaitingData())),
      viewFor(success(pendingData())),
      viewFor(success(deliveredData())),
      viewFor(success(staleData())),
      viewFor(success(inTransitData()), OCTOBER_NOW),
      viewFor(success(lookupUnavailableData("CJ"))),
      viewFor(success(customsWaitingData()), at("2026-09-29T09:00:00+09:00"))
    ];
    await openKit(page);
    for (const view of views) {
      await showView(page, view);
      const cta = page.locator(`[data-cta-state="${view.ctaState}"]`);
      await expect(cta, view.guideKey).toBeVisible();
      const filled = view.nextAction.primary !== null || view.nextAction.stores?.placement === "deliveredLead" ? 1 : 0;
      await expect(cta.locator('[data-slot="button"][data-variant="primary"]'), view.guideKey).toHaveCount(filled);
    }
  });
});

test.describe("clipboard", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copy-and-talk copies the inquiry text in the click that opens 톡톡 and shows what is copied", async ({ page }) => {
    await blockOtherHosts(page);
    const view = viewFor(success(staleData()));
    await openKit(page);
    await showView(page, view);
    const cta = page.locator('[data-cta-state="stale"]');
    await expect(cta.locator("[data-inquiry-preview]")).toHaveText(view.inquiryCopy ?? "");
    const link = cta.getByRole("link", { name: COPY_AND_TALK_NAME });
    await expect(link).toHaveAttribute("data-variant", "primary");
    await expect(link).toHaveAttribute("href", TALK_URL);
    const popup = page.waitForEvent("popup");
    await link.click();
    await (await popup).close();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(view.inquiryCopy);
    await expect
      .poll(() => kitActions(page))
      .toEqual(expect.arrayContaining([{ kind: "copied", what: "inquiry", outcome: "copied" }, { kind: "openedExternal", target: "talk" }]));
  });

  test("the return link copies view.returnLink and says so", async ({ page }) => {
    await removeShareSheet(page);
    const view = viewFor(success(customsWaitingData()));
    await openKit(page);
    await showView(page, view);
    await page.getByRole("button", { name: RETURN_LINK_NAME }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(view.returnLink);
    await expect(page.getByRole("button", { name: siteConfig.resultCopy.returnLinkCopied })).toBeVisible();
    expect(await kitActions(page)).toEqual([{ kind: "copied", what: "returnLink", outcome: "copied" }]);
  });
});

test("blocked clipboard: copy-and-talk still opens 톡톡 with a selectable box; the return link box is pre-selected", async ({ page }) => {
  await blockClipboard(page);
  await blockOtherHosts(page);
  const stale = viewFor(success(staleData()));
  await openKit(page);
  await showView(page, stale);
  const popup = page.waitForEvent("popup");
  await page.getByRole("link", { name: COPY_AND_TALK_NAME }).click();
  await (await popup).close();
  await expect(page.locator("textarea[data-copy-fallback]")).toHaveValue(stale.inquiryCopy ?? "");
  const waiting = viewFor(success(customsWaitingData()));
  await showView(page, waiting);
  await page.getByRole("button", { name: RETURN_LINK_NAME }).click();
  const box = page.locator("textarea[readonly]");
  await expect(box).toHaveValue(waiting.returnLink);
  await expect
    .poll(() => box.evaluate((element) => (element instanceof HTMLTextAreaElement ? element.selectionEnd - element.selectionStart : -1)))
    .toBe(waiting.returnLink.length);
  expect(await kitActions(page)).toEqual([{ kind: "copied", what: "returnLink", outcome: "fallback" }]);
});
