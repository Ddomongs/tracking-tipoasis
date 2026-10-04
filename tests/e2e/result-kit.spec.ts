import { expect, test, type Page } from "@playwright/test";
import { disclosures, lookup, notices, siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { deriveLoadingView } from "@/lib/tracking/loading-view";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import type { ActionView, FailureCause, LoadingViewModel, LookupOutcome, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import type { DeliveryCarrierCode } from "@/lib/types";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import {
  OCTOBER_NOW, ambiguousData, carrierCutData, customsWaitingData, deliveredData, failure, inTransitData, lookupUnavailableData,
  pendingData, staleData, success
} from "../fixtures/derive-scenarios";
import { FAKE, FIXTURE_NOW } from "../fixtures/tracking-fixtures";

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
  // The harness route compiles on first use in dev mode; under a full parallel run that can take longer than 5 s.
  await expect(page.locator('[data-result-kit="ready"]')).toBeAttached({ timeout: 15_000 });
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

/** True when `second` comes after `first` in document order (both must exist). */
async function follows(page: Page, first: string, second: string): Promise<boolean> {
  return page.evaluate(
    ([one, two]) => {
      const a = document.querySelector(one);
      const b = document.querySelector(two);
      return a !== null && b !== null && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    },
    [first, second] as const
  );
}

const RECOVERY_KINDS: readonly ActionView["kind"][] = ["fixNumber", "retry"];

function viewActions(view: TrackingViewModel): readonly ActionView[] {
  return [view.nextAction.primary, ...view.nextAction.secondary].filter((item): item is ActionView => item !== null);
}

/** Links of the error block in view order: every action that is not a recovery step and has an href. */
function inquiryHrefs(view: TrackingViewModel): readonly string[] {
  return viewActions(view)
    .filter((item) => !RECOVERY_KINDS.includes(item.kind) && item.href !== null)
    .map((item) => item.href ?? "");
}

function loadingAt(elapsedMs: number, carrier: DeliveryCarrierCode = "AUTO", reducedMotion = false): LoadingViewModel {
  return deriveLoadingView(
    { request: { number: FAKE.hbl, carrier, entry: "deepLink" }, elapsedMs, reducedMotion, now: FIXTURE_NOW },
    { lookup, notices }
  );
}

async function showLoading(page: Page, loading: LoadingViewModel): Promise<void> {
  await page.evaluate((nextLoading) => {
    const kit = window.__ttResultKit;
    if (kit === undefined) throw new Error("result kit is not ready");
    kit.show({ kind: "loading", loading: nextLoading });
  }, loading);
  await expect(page.locator(`[data-loading-stage="${loading.stage}"]`)).toBeVisible();
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
      // 10월 4일 요청 ②: the digits are drawn larger than the date words.
      const digits = Array.from(element.querySelectorAll("[data-eta-digit]")).map((node) => Number.parseFloat(getComputedStyle(node).fontSize));
      return { eta: visual === null ? 0 : Number.parseFloat(getComputedStyle(visual).fontSize), digits: Math.max(...digits), max: Math.max(...textSizes) };
    });
    expect(sizes.eta).toBeGreaterThanOrEqual(32);
    expect(sizes.max).toBe(Math.max(sizes.eta, sizes.digits));
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
    await expect(cta.getByRole("button", { name: "수령이 안 됐다면 여기를 눌러 주세요" })).toBeVisible();
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

test.describe("carrier chooser", () => {
  test("ambiguous: a '택배사 선택' group of five 44 px radio chips; a pointer choice reports chooseCarrier", async ({ page }) => {
    const view = viewFor(success(ambiguousData()));
    await openKit(page);
    await showView(page, view);
    const group = page.locator('[data-cta-state="ambiguous"]').getByRole("group", { name: "택배사 선택" });
    await expect(group.getByRole("radio")).toHaveCount(5);
    await expect(group.locator("label")).toHaveText((view.nextAction.carrierChoices ?? []).map((choice) => choice.name));
    const heights = await group.locator("label").evaluateAll((labels) => labels.map((label) => label.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
    await group.getByRole("radio", { name: "한진택배" }).click();
    expect(await kitActions(page)).toEqual([{ kind: "chooseCarrier", carrier: "HANJIN" }]);
  });

  test("a double click reports one choice", async ({ page }) => {
    await openKit(page);
    await showView(page, viewFor(success(ambiguousData())));
    await page.getByRole("group", { name: "택배사 선택" }).getByText("롯데택배", { exact: true }).dblclick();
    expect(await kitActions(page)).toEqual([{ kind: "chooseCarrier", carrier: "LOTTE" }]);
  });

  test("keyboard: arrows move without choosing; Space or Enter chooses the focused carrier", async ({ page }) => {
    await openKit(page);
    await showView(page, viewFor(success(ambiguousData())));
    const group = page.getByRole("group", { name: "택배사 선택" });
    await group.getByRole("radio", { name: "CJ대한통운" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "우체국택배" })).toBeFocused();
    expect(await kitActions(page)).toEqual([]);
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "한진택배" })).toBeFocused();
    await page.keyboard.press("Enter");
    expect(await kitActions(page)).toEqual([
      { kind: "chooseCarrier", carrier: "EPOST" },
      { kind: "chooseCarrier", carrier: "HANJIN" }
    ]);
  });

  test("a carrier lookup delay without an official link offers the same chooser under its sentence", async ({ page }) => {
    const view = viewFor(success(lookupUnavailableData("AUTO")));
    await openKit(page);
    await showView(page, view);
    const cta = page.locator('[data-cta-state="lookupUnavailable"]');
    await expect(cta.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();
    await expect(cta.getByRole("group", { name: "택배사 선택" }).getByRole("radio")).toHaveCount(5);
    await expect(cta.locator('[data-slot="button"][data-variant="primary"]')).toHaveCount(0);
  });
});

test.describe("last event, history, help and the recommendation slot", () => {
  test("the fixed order: status h2 → ETA → 지금 할 일 → last event → primary-end → 처리 내역", async ({ page }) => {
    await openKit(page);
    await showView(page, viewFor(success(customsWaitingData())));
    const chain = [
      "[data-result-view] h2",
      '[data-result-view] [data-slot="eta"]',
      "[data-result-view] [data-cta-state]",
      "[data-result-view] [data-last-event]",
      "[data-result-view] [data-primary-end]",
      "[data-result-view] details[data-history]"
    ];
    for (let index = 1; index < chain.length; index += 1) {
      expect(await follows(page, chain[index - 1], chain[index]), chain[index]).toBe(true);
    }
  });

  test("마지막 처리 line, then a closed '처리 내역' details grouped by station without aria-current", async ({ page }) => {
    const view = viewFor(success(customsWaitingData()));
    await openKit(page);
    await showView(page, view);
    const root = page.locator("[data-result-view]");
    const last = root.locator("[data-last-event]");
    await expect(last).toContainText("마지막 처리");
    await expect(last).toContainText(view.lastEvent?.text ?? "");
    await expect(last).toContainText(view.lastEvent?.original ?? "");
    const history = root.locator("details[data-history]");
    await expect(history).not.toHaveAttribute("open");
    await expect(history.locator("summary")).toHaveText(view.history.summaryText);
    await history.locator("summary").click();
    await expect(history).toHaveAttribute("open", "");
    await expect(history.locator("[data-history-segment]")).toHaveCount(view.history.segments.length);
    await expect(history.locator("li")).toHaveCount(view.history.count);
    await expect(history.locator("[aria-current]")).toHaveCount(0);
  });

  test("pending shows one sentence instead of an empty history", async ({ page }) => {
    const view = viewFor(success(pendingData()));
    await openKit(page);
    await showView(page, view);
    await expect(page.locator("[data-history-empty]")).toHaveText(view.history.emptyText ?? "");
    await expect(page.locator("details[data-history]")).toHaveCount(0);
  });

  test("수령이 안 됐다면 여기를 눌러 주세요 opens the 미수령 안내 and focuses its summary", async ({ page }) => {
    await openKit(page);
    await showView(page, viewFor(success(deliveredData())));
    const help = page.locator("details[data-delivered-help]");
    await expect(help).not.toHaveAttribute("open");
    await page.locator('[data-cta-state="delivered"]').getByRole("button", { name: "수령이 안 됐다면 여기를 눌러 주세요" }).click();
    await expect(help).toHaveAttribute("open", "");
    await expect(help.locator("summary")).toBeFocused();
  });

  test("help items follow the view: stale opens the customs-delay item", async ({ page }) => {
    const view = viewFor(success(staleData()));
    await openKit(page);
    await showView(page, view);
    const shown = await page
      .locator("[data-result-view] details[data-help]")
      .evaluateAll((items) => items.map((item) => [item.getAttribute("data-help"), item instanceof HTMLDetailsElement && item.open]));
    expect(shown).toEqual(view.help.map((item) => [item.id, item.defaultOpen]));
  });

  test("the recommendation slot: after the history, right after primary-end for delivered, absent without recommendations", async ({ page }) => {
    await openKit(page);
    await showView(page, viewFor(success(inTransitData()), OCTOBER_NOW), { withRecommendation: true });
    const slot = "[data-result-view] [data-recommendation-slot]";
    await expect(page.locator(`${slot} [data-recommended-products="inTransit"]`)).toBeVisible();
    expect(await follows(page, "[data-result-view] [data-primary-end]", slot)).toBe(true);
    expect(await follows(page, "[data-result-view] details[data-history]", slot)).toBe(true);

    await showView(page, viewFor(success(deliveredData())), { withRecommendation: true });
    await expect(page.locator(`${slot} [data-recommended-products="delivered"]`)).toBeVisible();
    expect(await follows(page, "[data-result-view] [data-primary-end]", slot)).toBe(true);
    expect(await follows(page, slot, "[data-result-view] details[data-history]")).toBe(true);

    await showView(page, viewFor(success(staleData())), { withRecommendation: true });
    await expect(page.locator('[data-cta-state="stale"]')).toBeVisible();
    await expect(page.locator(slot)).toHaveCount(0);
  });
});

test.describe("layout and modes", () => {
  test("desktop 1440: a 560 px main column with a 320 px side column to its right; 전체 보기 opens the history", async ({ page }) => {
    const view = viewFor(success(inTransitData()), OCTOBER_NOW);
    await openKit(page, 1440, 900);
    await showView(page, view);
    const main = await page.locator("[data-result-main]").boundingBox();
    const side = await page.locator("[data-side-column]").boundingBox();
    expect(Math.round(main?.width ?? 0)).toBe(560);
    expect(Math.round(side?.width ?? 0)).toBe(320);
    expect(side?.x ?? 0).toBeGreaterThan((main?.x ?? 0) + (main?.width ?? 0));
    const recent = page.locator("[data-history-recent]");
    await expect(recent.locator("li")).toHaveCount(view.history.recent.length);
    await recent.getByRole("button", { name: "전체 보기" }).click();
    await expect(page.locator("details[data-history]")).toHaveAttribute("open", "");
    await expect(page.locator("details[data-history] summary")).toBeFocused();
  });

  test("below 1024 px the side column follows the main column and the recent list stays hidden", async ({ page }) => {
    await openKit(page, 768, 1024);
    await showView(page, viewFor(success(inTransitData()), OCTOBER_NOW));
    const main = await page.locator("[data-result-main]").boundingBox();
    const side = await page.locator("[data-side-column]").boundingBox();
    expect(side?.y ?? 0).toBeGreaterThanOrEqual((main?.y ?? 0) + (main?.height ?? 0) - 1);
    await expect(page.locator("[data-history-recent]")).toBeHidden();
  });

  test("the mobile frame keeps one 375 px column even at 1440 and renders no recent list", async ({ page }) => {
    await openKit(page, 1440, 900);
    await showView(page, viewFor(success(inTransitData()), OCTOBER_NOW), { frame: "mobile" });
    const root = page.locator("[data-result-view]");
    await expect(root).toHaveAttribute("data-frame", "mobile");
    expect((await root.boundingBox())?.width ?? 0).toBeLessThanOrEqual(375);
    await expect(page.locator("[data-history-recent]")).toHaveCount(0);
    const main = await page.locator("[data-result-main]").boundingBox();
    const side = await page.locator("[data-side-column]").boundingBox();
    expect(side?.y ?? 0).toBeGreaterThanOrEqual((main?.y ?? 0) + (main?.height ?? 0) - 1);
  });

  test("read-only: links and buttons do nothing and report nothing, the details still open", async ({ page }) => {
    await blockOtherHosts(page);
    await openKit(page);
    await showView(page, viewFor(success(deliveredData())), { readOnly: true });
    await expect(page.locator("[data-result-view]")).toHaveAttribute("data-read-only", "true");
    let popups = 0;
    page.on("popup", () => {
      popups += 1;
    });
    await page.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" }).click();
    await page.locator('[data-cta-state="delivered"]').getByRole("button", { name: "수령이 안 됐다면 여기를 눌러 주세요" }).click();
    // A popup that slipped past the guard would open within this time.
    await page.waitForTimeout(500);
    expect(popups).toBe(0);
    await expect(page.locator("details[data-delivered-help]")).not.toHaveAttribute("open");
    expect(await kitActions(page)).toEqual([]);
    await page.locator("details[data-history] summary").click();
    await expect(page.locator("details[data-history]")).toHaveAttribute("open", "");
  });

  test("long places, terms and inquiry text wrap at 320 px", async ({ page }) => {
    const base = viewFor(success(staleData()));
    const longPlace = "경기도 광주시 도척면 도척윗로 물류센터 제2동 통관 대기 구역 하역장";
    const longTerm = "통관목록심사완료및보세운송신고수리후반출대기";
    const view: TrackingViewModel = {
      ...base,
      lastEvent: base.lastEvent === null ? null : { ...base.lastEvent, place: longPlace, original: longTerm },
      history: {
        ...base.history,
        segments: base.history.segments.map((segment) => ({
          ...segment,
          events: segment.events.map((event) => ({ ...event, place: longPlace, original: longTerm }))
        }))
      },
      inquiryCopy: base.inquiryCopy === null ? null : base.inquiryCopy.replace(base.number.grouped, groupTrackingNumber(FAKE.cargo))
    };
    await openKit(page, 320, 800);
    await showView(page, view);
    await page.locator("details[data-history] summary").click();
    await expect(page.locator("[data-inquiry-preview]")).toHaveText(view.inquiryCopy ?? "");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("320 px: no horizontal scroll in pending, delivered, ambiguous and overdue results", async ({ page }) => {
    await openKit(page, 320, 800);
    for (const view of [
      viewFor(success(pendingData())),
      viewFor(success(deliveredData())),
      viewFor(success(ambiguousData())),
      viewFor(success(customsWaitingData()), at("2026-09-29T09:00:00+09:00"))
    ]) {
      await showView(page, view);
      await expect(page.locator(`[data-cta-state="${view.ctaState}"]`)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, view.guideKey).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("failure card", () => {
  test("NOT_FOUND: 번호 수정 in the card, 톡톡 first in the error block, the worry line without a second 톡톡 link, no store", async ({ page }) => {
    const view = viewFor(failure("notFound"));
    await openKit(page);
    await showView(page, view, { failureCause: "notFound" });
    await expect(page.locator("[data-result-view]")).toHaveAttribute("data-result-view", "error");
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card).toHaveAttribute("data-guide-key", "notFound");
    await expect(card).toHaveAttribute("data-failure-cause", "notFound");
    await expect(card).toHaveAttribute("data-tone", "attention");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(view.title);
    const field = card.locator('[data-slot="status-head"]');
    await expect(field.locator('[aria-current="step"]')).toHaveCount(0);
    await expect(field.locator('[data-spine-part="unknown"]')).toHaveText("위치 확인 전");
    const fix = viewActions(view).find((item) => item.kind === "fixNumber");
    const fixButton = field.locator("[data-recovery]").getByRole("button", { name: fix?.label ?? "" });
    await expect(fixButton).toHaveAttribute("data-variant", fix?.weight ?? "");
    await expect(field.locator("[data-auxiliary-line]")).toHaveCount(view.auxiliaryLine === null ? 0 : 1);
    const cta = card.locator('[data-cta-state="error"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText(view.nextAction.heading ?? "");
    await expect(cta.locator(`a[href="${TALK_URL}"]`)).toHaveCount(1);
    await expect(cta.locator("[data-worry-line]")).toHaveText(view.nextAction.worry?.text ?? "");
    await expect(card.locator("[data-affiliate-group]")).toHaveCount(0);
    await expect(card.locator("details[data-help]")).toHaveCount(view.help.length);
    await fixButton.click();
    expect(await kitActions(page)).toEqual([{ kind: "fixNumber" }]);
  });

  test("every error view: recovery steps in the card, 톡톡 first in the only error block, no ETA, no store", async ({ page }) => {
    await openKit(page);
    const causes: readonly FailureCause[] = [
      "invalidNumber", "notFound", "rateLimited", "upstreamTimeout", "badGateway", "network", "offline", "clientTimeout", "serverError",
      "contractViolation"
    ];
    for (const cause of causes) {
      const view = viewFor(failure(cause));
      await showView(page, view, { failureCause: cause });
      const card = page.locator(`[data-result-view] [data-failure-cause="${cause}"]`);
      await expect(card, cause).toHaveAttribute("data-guide-key", view.guideKey);
      const cta = page.locator('[data-cta-state="error"]');
      await expect(cta, cause).toHaveCount(1);
      const hrefs = await cta.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
      expect(hrefs, cause).toEqual(inquiryHrefs(view));
      expect(hrefs[0], cause).toBe(TALK_URL);
      const recoveryCount = viewActions(view).filter((item) => RECOVERY_KINDS.includes(item.kind)).length;
      await expect(card.locator("[data-recovery] button"), cause).toHaveCount(recoveryCount);
      await expect(card.locator('[data-slot="eta"]'), cause).toHaveCount(0);
      await expect(card.locator("[data-affiliate-group]"), cause).toHaveCount(0);
    }
  });

  test("429: 다시 조회 waits out the countdown; clicks before it report nothing", async ({ page }) => {
    await page.clock.install({ time: FIXTURE_NOW });
    const view = viewFor(failure("rateLimited"));
    await openKit(page);
    await showView(page, view, { failureCause: "rateLimited" });
    await expect(page.locator("[data-result-view] [data-guide-key]")).toContainText(view.reason ?? "");
    const retry = page.locator("[data-recovery]").getByRole("button", { name: "다시 조회" });
    await expect(retry).toHaveAttribute("aria-disabled", "true");
    // Playwright treats aria-disabled as disabled; force the clicks a customer can still make.
    await retry.click({ force: true });
    await retry.dblclick({ force: true });
    expect(await kitActions(page)).toEqual([]);
    await page.clock.runFor(10_000);
    await expect(retry).not.toHaveAttribute("aria-disabled");
    await retry.click();
    expect(await kitActions(page)).toEqual([{ kind: "retry" }]);
  });

  test("server error: 문의 내용 복사하고 톡톡 열기 leads the error block with the copied text shown; 다시 조회 stays in the card", async ({ page }) => {
    const view = viewFor(failure("serverError"));
    await openKit(page);
    await showView(page, view, { failureCause: "serverError" });
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card).toHaveAttribute("data-tone", "problem");
    const cta = card.locator('[data-cta-state="error"]');
    const first = cta.locator("a[href]").first();
    await expect(first).toHaveAccessibleName(COPY_AND_TALK_NAME);
    await expect(first).toHaveAttribute("data-variant", "primary");
    await expect(cta.locator("[data-inquiry-preview]")).toHaveText(view.inquiryCopy ?? "");
    await expect(card.locator("[data-recovery]").getByRole("button", { name: "다시 조회" })).toBeVisible();
  });

  test("two failures in a row: 톡톡 becomes the filled primary and the recovery step stays in the card", async ({ page }) => {
    const view = viewFor(failure("network", { consecutiveFailures: 2 }));
    expect(view.nextAction.primary?.kind).toBe("copyAndTalk");
    await openKit(page);
    await showView(page, view, { failureCause: "network" });
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card.locator('[data-cta-state="error"] a[href]').first()).toHaveAccessibleName(COPY_AND_TALK_NAME);
    await expect(card.locator("[data-recovery]").getByRole("button", { name: "다시 조회" })).toHaveAttribute("data-variant", "secondary");
  });

  test("no response: the recovery steps in the card and no '번호 문제는 아니에요'", async ({ page }) => {
    const view = viewFor(failure("clientTimeout"));
    await openKit(page);
    await showView(page, view, { failureCause: "clientTimeout" });
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card).toHaveAttribute("data-guide-key", "noResponse");
    await expect(card).not.toContainText("번호 문제는 아니에요");
    const recoveryLabels = viewActions(view)
      .filter((item) => RECOVERY_KINDS.includes(item.kind))
      .map((item) => item.label);
    expect(recoveryLabels).toContain("다시 조회");
    await expect(card.locator("[data-recovery] button")).toHaveText(recoveryLabels);
  });

  test("a delay with a chosen carrier: 톡톡 first, then that carrier's official lookup", async ({ page }) => {
    const view = viewFor(failure("upstreamTimeout", { carrier: "CJ" }));
    await openKit(page);
    await showView(page, view, { failureCause: "upstreamTimeout" });
    const hrefs = await page
      .locator('[data-cta-state="error"] a[href]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    expect(hrefs).toEqual(inquiryHrefs(view));
    expect(hrefs[0]).toBe(TALK_URL);
  });

  test("the invalid view (CS preview) shows the input sentence as its title and 톡톡 as the only link", async ({ page }) => {
    const view = viewFor(failure("invalidNumber"));
    await openKit(page);
    await showView(page, view, { failureCause: "invalidNumber" });
    await expect(page.locator("[data-result-view] h2")).toHaveText(view.title);
    const hrefs = await page.locator('[data-cta-state="error"] a[href]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs).toEqual([TALK_URL]);
  });
});

test.describe("loading card", () => {
  test("short wait: '조회하고 있어요', aria-busy, static skeletons, no cancel yet", async ({ page }) => {
    const model = loadingAt(1_000);
    expect(model.stage).toBe("short");
    await openKit(page);
    await showLoading(page, model);
    const card = page.locator("[data-loading-stage]");
    await expect(card).toHaveAttribute("data-guide-key", "loading");
    await expect(card).toHaveAttribute("aria-busy", "true");
    await expect(card).toHaveAttribute("data-ad-exclude", "true");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(model.title);
    await expect(card.getByText(model.body, { exact: true })).toBeVisible();
    for (const part of ["journey", "eta", "next-action"]) {
      await expect(card.locator(`[data-loading-skeleton="${part}"]`), part).toHaveAttribute("aria-hidden", "true");
    }
    await expect(card.getByRole("button")).toHaveCount(0);
  });

  test("3 s: the long-wait sentence and [조회 취소], which reports cancel", async ({ page }) => {
    const model = loadingAt(3_500);
    expect(model.stage).toBe("long");
    await openKit(page);
    await showLoading(page, model);
    const card = page.locator("[data-loading-stage]");
    await expect(card.locator("[data-loading-extra]")).toHaveText(model.extra ?? "");
    await card.getByRole("button", { name: model.cancel?.label ?? "" }).click();
    expect(await kitActions(page)).toEqual([{ kind: "cancel" }]);
  });

  test("8 s with a chosen carrier: the elapsed time and the carrier's official link; the spinner has stopped", async ({ page }) => {
    const model = loadingAt(9_000, "CJ");
    expect(model.stage).toBe("veryLong");
    await openKit(page);
    await showLoading(page, model);
    const card = page.locator("[data-loading-stage]");
    await expect(card.locator("[data-loading-extra]")).toHaveText(model.extra ?? "");
    await expect(card.locator("[data-loading-elapsed]")).toHaveText(model.elapsedText ?? "");
    const official = card.getByRole("link", { name: `${model.carrierOfficial?.label ?? ""} 새 창으로 열기` });
    await expect(official).toHaveAttribute("href", model.carrierOfficial?.href ?? "");
    await expect(card.locator("[data-spinner]")).toHaveCount(0);
  });

  test("the spinner turns a finite number of times, and not at all with reduced motion", async ({ page }) => {
    await openKit(page);
    await showLoading(page, loadingAt(1_000));
    const timing = await page.locator("[data-spinner]").evaluate((element) =>
      element.getAnimations().map((animation) => {
        const effect = animation.effect?.getTiming();
        return { iterations: effect?.iterations ?? 0, duration: Number(effect?.duration ?? 0) };
      })
    );
    expect(timing).toEqual([{ iterations: 5, duration: 1_000 }]);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await showLoading(page, loadingAt(1_000, "AUTO", true));
    await expect(page.locator("[data-spinner]")).toHaveCount(0);
    await showLoading(page, { ...loadingAt(1_000), spinnerActive: true });
    expect(await page.locator("[data-spinner]").evaluate((element) => element.getAnimations().length)).toBe(0);
  });

  test("an outage notice shows as the in-card '안내' line", async ({ page }) => {
    const model: LoadingViewModel = {
      ...loadingAt(1_000),
      outageNotice: { id: "kit-outage", kind: "outage", title: "통관 조회 점검", body: "UNI-PASS 점검(22:00~24:00) 중에는 통관 정보가 늦게 보일 수 있어요" }
    };
    await openKit(page);
    await showLoading(page, model);
    await expect(page.locator('[data-loading-stage] [data-notice-kind="outage"]')).toContainText(model.outageNotice?.body ?? "");
  });
});

test.describe("pending help line (approval 4)", () => {
  test("pending: the help line follows the purchase choices and opens the order-check help with its summary focused", async ({ page }) => {
    const view = viewFor(success(pendingData()));
    const help = view.help.find((item) => item.id === "order-check");
    expect(help).toBeDefined();
    await openKit(page);
    await showView(page, view);
    const line = page.locator('[data-cta-state="pending"]').getByRole("button", { name: help?.summary ?? "" });
    await expect(line).toHaveAttribute("data-help-link", "order-check");
    expect(await follows(page, '[data-cta-state="pending"] [data-affiliate-group]', '[data-cta-state="pending"] [data-help-link]')).toBe(true);
    const details = page.locator('[data-result-view] details[data-help="order-check"]');
    await expect(details).not.toHaveAttribute("open");
    await line.click();
    await expect(details).toHaveAttribute("open", "");
    await expect(details.locator("summary")).toBeFocused();
    expect(await kitActions(page)).toEqual([]);
  });

  test("the help line belongs to pending only", async ({ page }) => {
    await openKit(page);
    await showView(page, viewFor(failure("notFound")), { failureCause: "notFound" });
    await expect(page.locator("[data-help-link]")).toHaveCount(0);
    await showView(page, viewFor(success(customsWaitingData())));
    await expect(page.locator("[data-help-link]")).toHaveCount(0);
  });
});
