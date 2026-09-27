import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { RESULT_APPROVALS } from "@/components/result/approvals";
import { channels, disclosures, lookup, siteConfig } from "@/config/site.config";
import { getDeliveryCarrier } from "@/lib/delivery-carriers";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { OCTOBER_NOW, customsWaitingData, failure, inTransitData, success } from "../fixtures/derive-scenarios";
import { FAKE, FIXTURE_NOW, mockTrack, successBody, trackData, type FailureFixture } from "../fixtures/tracking-fixtures";

/**
 * Every §7 row end to end (deep links and manual lookups against mocked /api/track). Business rules are asserted
 * through hooks and roles; expected copy that is not E2E-locked comes from deriveTrackingView with the shipped config.
 */
const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const TALK_URL = channels.talk.url;
const TALK_NAME = `${channels.talk.labels.cta} 새 창으로 열기`;
const COPY_AND_TALK_NAME = `${channels.talk.labels.copyAndTalk} 새 창으로 열기`;
const STORE_HREFS: readonly string[] = [...Object.values(channels.naver.urls), ...Object.values(channels.coupang.urls)];
const OVERDUE_NOW = new Date("2026-09-29T09:00:00+09:00");

function viewFor(outcome: LookupOutcome, now: Date = FIXTURE_NOW): TrackingViewModel {
  return deriveTrackingView(outcome, now, siteConfig);
}

async function blockOtherHosts(page: Page): Promise<void> {
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

/** Opens `/{number}` with /api/track answering `reply`; the browser clock reads `now` (timers keep running). */
async function openDeepLink(
  page: Page,
  reply: TrackResponseData | FailureFixture,
  options: { readonly now?: Date; readonly delayMs?: number } = {}
): Promise<void> {
  await page.clock.setFixedTime(options.now ?? FIXTURE_NOW);
  await blockOtherHosts(page);
  await mockTrack(page, reply, { delayMs: options.delayMs });
  await page.goto(`/${typeof reply === "string" ? FAKE.domestic : reply.trackingNumber}`);
}

/** Answers POST /api/track with `replies` in order (the last one repeats) and records every request body. */
async function mockTrackSequence(page: Page, replies: readonly TrackResponseData[], bodies: unknown[]): Promise<void> {
  let index = 0;
  await page.route("**/api/track", async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    bodies.push(route.request().postDataJSON());
    const reply = replies[Math.min(index, replies.length - 1)];
    index += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: successBody(reply) });
  });
}

function resultCard(page: Page): Locator {
  return page.locator("[data-result-view] [data-guide-key]");
}

async function storeLinkCount(scope: Locator): Promise<number> {
  const hrefs = await scope.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href") ?? ""));
  return hrefs.filter((href) => STORE_HREFS.includes(href)).length;
}

/** Store links anywhere on the page that come before `marker` in document order. */
async function storeLinksBefore(page: Page, marker: string): Promise<number> {
  return page.evaluate(
    ({ selector, hrefs }) => {
      const end = document.querySelector(selector);
      if (end === null) return -1;
      return Array.from(document.querySelectorAll("a[href]")).filter(
        (anchor) =>
          hrefs.includes(anchor.getAttribute("href") ?? "") && (anchor.compareDocumentPosition(end) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      ).length;
    },
    { selector: marker, hrefs: [...STORE_HREFS] }
  );
}

test.describe("loading", () => {
  test("a deep link shows '조회하고 있어요' in the server HTML and the result fills the same place", async ({ page, request }) => {
    const html = await (await request.get(`/${FAKE.hbl}`)).text();
    expect(html).toContain('data-loading-stage="instant"');
    expect(html).toContain(lookup.copy.title);
    await openDeepLink(page, trackData("customsWaiting"), { delayMs: 1_500 });
    const loadingCard = page.locator("[data-loading-stage]");
    await expect(loadingCard.getByRole("heading", { level: 2 })).toHaveText(lookup.copy.title);
    await expect(loadingCard).toHaveAttribute("aria-busy", "true");
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "customsWaiting");
    await expect(page.locator("[data-loading-stage]")).toHaveCount(0);
  });

  test("long waits add the 3 s sentence and [조회 취소]; cancelling keeps the number for editing", async ({ page }) => {
    await page.clock.install({ time: FIXTURE_NOW });
    await blockOtherHosts(page);
    await page.route("**/api/track", () => undefined); // never answers
    await page.goto(`/${FAKE.domestic}`);
    const loadingCard = page.locator("[data-loading-stage]");
    await expect(loadingCard.getByRole("heading", { level: 2 })).toHaveText(lookup.copy.title);
    await page.clock.runFor(3_100);
    await expect(loadingCard).toHaveAttribute("data-loading-stage", "long");
    await expect(loadingCard.locator("[data-loading-extra]")).toHaveText(lookup.copy.longWait);
    await loadingCard.getByRole("button", { name: lookup.copy.cancel }).click();
    await expect(page.locator("[data-loading-stage]")).toHaveCount(0);
    const value = await page.getByLabel(INPUT_LABEL, { exact: true }).inputValue();
    expect(value.replace(/[\s-]/g, "")).toBe(FAKE.domestic);
  });
});

test.describe("errors", () => {
  test("NOT_FOUND: 번호 수정 in the card, 톡톡 first in the only error block, no store link anywhere in the result", async ({ page }) => {
    const view = viewFor(failure("notFound"));
    await openDeepLink(page, "notFound404");
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-guide-key", "notFound");
    await expect(card).toHaveAttribute("data-failure-cause", "notFound");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(view.title);
    await expect(card.locator('[aria-current="step"]')).toHaveCount(0);
    const fix = [view.nextAction.primary, ...view.nextAction.secondary].find((item) => item?.kind === "fixNumber");
    await expect(card.locator("[data-recovery]").getByRole("button", { name: fix?.label ?? "" })).toBeVisible();
    const cta = page.locator('[data-cta-state="error"]');
    await expect(cta).toHaveCount(1);
    expect(await cta.locator("a[href]").first().getAttribute("href")).toBe(TALK_URL);
    await expect(card.locator("[data-auxiliary-line]")).toHaveCount(lookup.notFoundServiceCaveat ? 1 : 0);
    expect(await storeLinkCount(page.locator("[data-view-state]"))).toBe(0);
  });

  for (const fixture of [
    "notFound404", "rateLimited429", "upstreamTimeout504", "unavailable503", "serverError500", "badGatewayHtml502", "contractViolation200"
  ] as const) {
    test(`every error response keeps 톡톡 first and shows no store or ETA: ${fixture}`, async ({ page }) => {
      await openDeepLink(page, fixture);
      await expect(page.locator("[data-result-view]")).toHaveAttribute("data-result-view", "error");
      const cta = page.locator('[data-cta-state="error"]');
      await expect(cta).toHaveCount(1);
      expect(await cta.locator("a[href]").first().getAttribute("href")).toBe(TALK_URL);
      await expect(page.locator('[data-result-view] [data-slot="eta"]')).toHaveCount(0);
      expect(await storeLinkCount(page.locator("[data-view-state]"))).toBe(0);
      await expect(page.locator("[data-result-view]")).not.toContainText("관리자에게 문의해주세요");
    });
  }

  test("429: [다시 조회] waits out the countdown, then looks the number up again", async ({ page }) => {
    await page.clock.install({ time: FIXTURE_NOW });
    await blockOtherHosts(page);
    const bodies: unknown[] = [];
    await mockTrack(page, "rateLimited429", { onRequest: (body) => bodies.push(body) });
    await page.goto(`/${FAKE.domestic}`);
    const retry = page.locator("[data-recovery]").getByRole("button", { name: "다시 조회" });
    await expect(retry).toHaveAttribute("aria-disabled", "true");
    // Playwright treats aria-disabled as disabled; force the click a customer can still make.
    await retry.click({ force: true });
    expect(bodies).toHaveLength(1);
    await page.clock.runFor(lookup.rateLimitCooldownSeconds * 1_000);
    await expect(retry).not.toHaveAttribute("aria-disabled");
    await retry.click();
    await expect.poll(() => bodies.length).toBe(2);
  });

  test("server error: [문의 내용 복사하고 톡톡 열기] leads the error block and shows the copied text", async ({ page }) => {
    const view = viewFor(failure("serverError"));
    await openDeepLink(page, "serverError500");
    const cta = page.locator('[data-cta-state="error"]');
    await expect(cta.locator("a[href]").first()).toHaveAccessibleName(COPY_AND_TALK_NAME);
    await expect(cta.locator("[data-inquiry-preview]")).toHaveText(view.inquiryCopy ?? "");
  });

  test("no response after the client timeout: no '번호 문제는 아니에요', 톡톡 first", async ({ page }) => {
    await page.clock.install({ time: FIXTURE_NOW });
    await blockOtherHosts(page);
    await page.route("**/api/track", () => undefined); // never answers
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator("[data-loading-stage]")).toBeVisible();
    await page.clock.runFor(lookup.timeoutMs + 1_000);
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-guide-key", "noResponse");
    await expect(card).not.toContainText("번호 문제는 아니에요");
    expect(await page.locator('[data-cta-state="error"] a[href]').first().getAttribute("href")).toBe(TALK_URL);
  });

  test("two failures in a row make [문의 내용 복사하고 톡톡 열기] the filled primary", async ({ page }) => {
    await openDeepLink(page, "upstreamTimeout504");
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "temporaryDelay");
    await page.locator("[data-recovery]").getByRole("button", { name: "다시 조회" }).click();
    const first = page.locator('[data-cta-state="error"] a[href]').first();
    await expect(first).toHaveAccessibleName(COPY_AND_TALK_NAME);
    await expect(first).toHaveAttribute("data-variant", "primary");
  });

  test("offline: the offline card, then one automatic lookup when the connection returns", async ({ page }) => {
    await page.clock.setFixedTime(FIXTURE_NOW);
    await blockOtherHosts(page);
    await mockTrack(page, trackData("inTransit"));
    await page.goto("/");
    const input = page.getByLabel(INPUT_LABEL, { exact: true });
    // Focus in the lookup form preloads the result module; wait until its chunk and the scripts requested with it have
    // arrived. (A second waitForLoadState("networkidle") returns at once: that state is reached only once per load.)
    const pendingScripts = new Set<string>();
    page.on("request", (request) => {
      if (request.resourceType() === "script") pendingScripts.add(request.url());
    });
    const settleScript = (url: string): void => {
      pendingScripts.delete(url);
    };
    page.on("requestfinished", (request) => settleScript(request.url()));
    page.on("requestfailed", (request) => settleScript(request.url()));
    const resultChunk = page.waitForResponse(
      async (response) => response.request().resourceType() === "script" && (await response.text()).includes("data-primary-end"),
      { timeout: 15_000 }
    );
    await input.fill(FAKE.hbl);
    await resultChunk;
    await expect.poll(() => pendingScripts.size, { timeout: 15_000 }).toBe(0);
    await page.context().setOffline(true);
    await input.press("Enter");
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "offline");
    await page.context().setOffline(false);
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "inTransit");
  });

  test("an invalid number: one error block below the form with 톡톡 first, and no store link", async ({ page }) => {
    await blockOtherHosts(page);
    await page.goto("/");
    const input = page.getByLabel(INPUT_LABEL, { exact: true });
    await input.fill(FAKE.invalidShort);
    await input.press("Enter");
    await expect(page.locator('[data-guide-key="invalidNumber"]')).toBeVisible();
    const cta = page.locator('[data-cta-state="error"]');
    await expect(cta).toHaveCount(1);
    expect(await cta.locator("a[href]").first().getAttribute("href")).toBe(TALK_URL);
    await expect(page.locator("[data-result-view]")).toHaveCount(0);
    expect(await storeLinkCount(page.locator("[data-view-state]"))).toBe(0);
  });

  test("a result module that cannot load leaves the 톡톡 fallback; opening the link again shows the result", async ({ page }) => {
    let blockResultChunk = true;
    await page.route("**/_next/static/**/*.js", async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (blockResultChunk && body.includes("data-primary-end")) {
        await route.abort();
        return;
      }
      await route.fulfill({ response, body });
    });
    await openDeepLink(page, trackData("inTransit"));
    const fallback = page.locator("[data-result-module-failure]");
    await expect(fallback.getByRole("link", { name: TALK_NAME })).toBeVisible();
    await expect(page.locator("[data-loading-stage]")).toHaveCount(0);
    blockResultChunk = false;
    await page.goto(`/${FAKE.hbl}`);
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "inTransit");
    // Chunk requests still in flight must not outlive the page (route.fetch after close).
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });
});

test.describe("settled states", () => {
  test("pending: '통관 정보 등록 전', '정보 등록 후 안내', 톡톡 and the purchase choices after the disclosure", async ({ page }) => {
    await openDeepLink(page, trackData("pending"));
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-guide-key", "pending");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText("통관 정보 등록 전");
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", "pendingInfo");
    await expect(card.locator("[data-eta-text]")).toHaveText("정보 등록 후 안내");
    const cta = page.locator('[data-cta-state="pending"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText("아직 국내 배송 정보가 없어요");
    await expect(cta.getByRole("link", { name: TALK_NAME })).toBeVisible();
    await expect(cta.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
    await expect(cta.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toBeVisible();
    await expect(cta.getByRole("link", { name: "쿠팡 스토어 보기 새 창으로 열기" })).toHaveAttribute("rel", /sponsored/);
    expect(await storeLinksBefore(page, "[data-result-view] [data-primary-end]")).toBe(2);
    await expect(page.locator('[data-recommended-products="pending"]')).toBeVisible();
  });

  test("customs waiting: holiday badge instead of D-n, the notice line, no filled button, a worry line with 톡톡", async ({ page }) => {
    const data = trackData("customsWaiting");
    const view = viewFor(success(data));
    await openDeepLink(page, data);
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-guide-key", "customsWaiting");
    await expect(card).toHaveAttribute("data-tone", "progress");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(view.title);
    await expect(card.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", view.eta.kind);
    await expect(card.locator("[data-eta-dday]")).toHaveCount(0);
    if (view.eta.kind === "holidayAffected") await expect(card.locator("[data-eta-badge]")).toHaveText(view.eta.badge);
    await expect(card.locator('[data-notice-variant="inline"]')).toHaveCount(view.notice === null ? 0 : 1);
    const cta = page.locator('[data-cta-state="customsWaiting"]');
    await expect(cta.locator('[data-slot="button"][data-variant="primary"]')).toHaveCount(0);
    await expect(cta.locator("[data-worry-line]")).toContainText(view.nextAction.worry?.text ?? "");
    await expect(cta.locator(`a[href="${TALK_URL}"]`)).toHaveCount(1);
    await expect(page.locator("[data-result-view] details[data-history] summary")).toHaveText(view.history.summaryText);
  });

  test("customs cleared: the customs station stays current with '인계 대기' and the cleared date as the caption", async ({ page }) => {
    const data = trackData("customsCleared");
    const view = viewFor(success(data));
    await openDeepLink(page, data);
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-guide-key", "customsCleared");
    await expect(card.locator('[data-station="customs"]')).toHaveAttribute("aria-current", "step");
    await expect(card.locator('[data-station="customs"] [data-spine-part="sub"]')).toHaveText("인계 대기");
    const caption = "caption" in view.eta ? view.eta.caption : null;
    if (caption !== null) await expect(card.locator("[data-eta-caption]")).toHaveText(caption);
    await expect(page.locator('[data-cta-state="customsCleared"]')).toBeVisible();
  });

  test("picked up: 'CJ대한통운 기사님 픽업 완료!' and the carrier's official lookup as the primary", async ({ page }) => {
    const data = trackData("pickedUp");
    const view = viewFor(success(data));
    await openDeepLink(page, data);
    await expect(resultCard(page).getByRole("heading", { level: 2 })).toHaveText("CJ대한통운 기사님 픽업 완료!");
    const cta = page.locator('[data-cta-state="customsCleared"]');
    const official = cta.locator("a[href]").first();
    await expect(official).toHaveAttribute("href", view.carrier.officialUrl ?? "");
    await expect(official).toHaveAttribute("data-variant", "primary");
  });

  test("in transit: '국내 배송 중', the carrier's live link first, no store link before the primary end", async ({ page }) => {
    const data = inTransitData();
    const view = viewFor(success(data), OCTOBER_NOW);
    await openDeepLink(page, data, { now: OCTOBER_NOW });
    const card = resultCard(page);
    await expect(card.getByRole("heading", { level: 2 })).toHaveText("국내 배송 중");
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", view.eta.kind);
    const cta = page.locator('[data-cta-state="inTransit"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText("배송이 진행 중이에요");
    await expect(cta.locator("a[href]").first()).toHaveAttribute("href", view.carrier.officialUrl ?? "");
    await expect(cta.getByRole("link", { name: TALK_NAME })).toBeVisible();
    expect(await storeLinksBefore(page, "[data-result-view] [data-primary-end]")).toBe(0);
    await expect(page.locator('[data-recommended-products="inTransit"]')).toBeVisible();
  });

  test("delivered: '배송 완료', '배송 완료일', and 지금 할 일 leads with the two store links", async ({ page }) => {
    await openDeepLink(page, trackData("delivered"));
    const card = resultCard(page);
    await expect(card.getByRole("heading", { level: 2 })).toHaveText("배송 완료");
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", "deliveredOn");
    await expect(card.locator("[data-eta-label]")).toHaveText("배송 완료일");
    const cta = page.locator('[data-cta-state="delivered"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText("배송이 완료됐어요");
    const firstTwo = await cta.locator("a[href]").evaluateAll((links) => links.slice(0, 2).map((link) => link.getAttribute("href") ?? ""));
    expect(firstTwo).toEqual([channels.naver.urls.deliveredLead, channels.coupang.urls.deliveredLead]);
    await expect(cta.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
    await expect(cta.getByRole("link", { name: TALK_NAME })).toBeVisible();
    await expect(page.locator('[data-recommended-products="delivered"]')).toBeVisible();
  });

  test("overdue: attention tone, [문의 내용 복사하고 톡톡 열기] first, no recommendations or store links", async ({ page }) => {
    const data = customsWaitingData();
    const view = viewFor(success(data), OVERDUE_NOW);
    expect(view.overdue).toBe(true);
    await openDeepLink(page, data, { now: OVERDUE_NOW });
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-overdue", "true");
    await expect(card).toHaveAttribute("data-tone", "attention");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(view.title);
    await expect(page.locator('[data-cta-state="customsWaiting"] a[href]').first()).toHaveAccessibleName(COPY_AND_TALK_NAME);
    await expect(page.locator("[data-recommended-products]")).toHaveCount(0);
    expect(await storeLinkCount(page.locator("[data-view-state]"))).toBe(0);
  });

  test("stale: a verification prompt instead of an estimate — withheld ETA, '멈춤', copy-and-talk first, no '오늘 예상'", async ({ page }) => {
    await openDeepLink(page, trackData("stale"));
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-guide-key", "stale");
    await expect(card).toHaveAttribute("data-tone", "attention");
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", "withheld");
    await expect(card.locator("[data-eta-text]")).toHaveText("지금은 도착 예상일을 안내하기 어려워요");
    await expect(page.locator("[data-result-view]")).not.toContainText("오늘 예상");
    await expect(card.locator('[data-issue="stopped"]')).toHaveCount(1);
    await expect(page.locator('[data-cta-state="stale"] a[href]').first()).toHaveAccessibleName(COPY_AND_TALK_NAME);
    await expect(page.locator("[data-recommended-products]")).toHaveCount(0);
  });

  test("carrier lookup delay with a known carrier: the cut mark and that carrier's official lookup first", async ({ page }) => {
    const data = trackData("lookupUnavailableCarrier");
    const view = viewFor(success(data));
    await openDeepLink(page, data);
    const card = resultCard(page);
    await expect(card).toHaveAttribute("data-guide-key", "lookupUnavailable");
    await expect(card.locator('[data-issue="cut"]')).toHaveCount(1);
    await expect(page.locator('[data-cta-state="lookupUnavailable"] a[href]').first()).toHaveAttribute("href", view.carrier.officialUrl ?? "");
    await expect(page.locator("[data-carrier-chooser]")).toHaveCount(0);
  });

  test("carrier lookup delay without a carrier: choosing 한진택배 looks the same number up again with that carrier", async ({ page }) => {
    const bodies: unknown[] = [];
    await page.clock.setFixedTime(FIXTURE_NOW);
    await blockOtherHosts(page);
    await mockTrackSequence(page, [trackData("lookupUnavailableAuto"), trackData("inTransit", { trackingNumber: FAKE.domestic })], bodies);
    await page.goto(`/${FAKE.domestic}`);
    await page.getByRole("group", { name: "택배사 선택" }).getByRole("radio", { name: "한진택배" }).click();
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "inTransit");
    expect(bodies).toEqual([
      { trackingNumber: FAKE.domestic, carrierCode: "AUTO" },
      { trackingNumber: FAKE.domestic, carrierCode: "HANJIN" }
    ]);
  });

  test("ambiguous: arrowing through the carriers starts nothing; Space chooses and looks up again", async ({ page }) => {
    const bodies: unknown[] = [];
    await page.clock.setFixedTime(FIXTURE_NOW);
    await blockOtherHosts(page);
    await mockTrackSequence(page, [trackData("ambiguous"), trackData("inTransit", { trackingNumber: FAKE.domestic })], bodies);
    await page.goto(`/${FAKE.domestic}`);
    const group = page.getByRole("group", { name: "택배사 선택" });
    await group.getByRole("radio", { name: "CJ대한통운" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "우체국택배" })).toBeFocused();
    expect(bodies).toHaveLength(1);
    await page.keyboard.press("Space");
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "inTransit");
    expect(bodies[1]).toEqual({ trackingNumber: FAKE.domestic, carrierCode: "EPOST" });
  });

  test("a carrier lookup delay under customs: the auxiliary [다시 조회] looks the same number up again", async ({ page }) => {
    const bodies: unknown[] = [];
    await page.clock.setFixedTime(FIXTURE_NOW);
    await blockOtherHosts(page);
    const data = trackData("customsWithCarrierCut");
    await mockTrackSequence(page, [data], bodies);
    await page.goto(`/${data.trackingNumber}`);
    const line = resultCard(page).locator("[data-auxiliary-line]");
    await expect(resultCard(page).locator('[data-station="domestic"]')).toHaveAttribute("data-issue", "cut");
    await line.getByRole("button", { name: "다시 조회" }).click();
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies[1]).toEqual(bodies[0]);
  });

  test("a carrier chosen in the form reaches the request, the number bar and the official link", async ({ page }) => {
    const bodies: unknown[] = [];
    await page.clock.setFixedTime(FIXTURE_NOW);
    await blockOtherHosts(page);
    const base = trackData("inTransit", { trackingNumber: FAKE.domestic });
    const data: TrackResponseData = {
      ...base,
      delivery: {
        ...base.delivery,
        carrier: "한진택배",
        carrierCode: "HANJIN",
        invoiceNumber: FAKE.domestic,
        trackingUrl: getDeliveryCarrier("HANJIN").trackingUrl(FAKE.domestic)
      }
    };
    await mockTrack(page, data, { onRequest: (body) => bodies.push(body) });
    await page.goto("/");
    await page.getByRole("combobox", { name: "국내 택배사" }).selectOption("HANJIN");
    const input = page.getByLabel(INPUT_LABEL, { exact: true });
    await input.fill(FAKE.domestic);
    await input.press("Enter");
    await expect(resultCard(page)).toHaveAttribute("data-guide-key", "inTransit");
    expect(bodies).toEqual([{ trackingNumber: FAKE.domestic, carrierCode: "HANJIN" }]);
    await expect(page.locator("[data-number-bar]")).toContainText("한진택배");
    await expect(page.locator('[data-cta-state="inTransit"] a[href]').first()).toHaveAttribute("href", data.delivery.trackingUrl ?? "");
  });
});

test.describe("a browser in America/New_York", () => {
  test.use({ timezoneId: "America/New_York" });

  test("a browser in America/New_York shows the KST view: the date and the worry line", async ({ page }) => {
    const data = customsWaitingData();
    const view = viewFor(success(data));
    await openDeepLink(page, data);
    const card = resultCard(page);
    if ("date" in view.eta) await expect(card.locator('[data-slot="eta"] [data-eta-value] .sr-only')).toHaveText(view.eta.date.label);
    await expect(page.locator('[data-cta-state="customsWaiting"] [data-worry-line]')).toContainText(view.nextAction.worry?.text ?? "");
    await expect(card).toHaveAttribute("data-overdue", "false");
  });

  test("overdue flips at KST midnight while it is still the day before in New York", async ({ page }) => {
    await openDeepLink(page, customsWaitingData(), { now: new Date("2026-09-29T00:00:30+09:00") });
    await expect(resultCard(page)).toHaveAttribute("data-overdue", "true");
  });
});

test.describe("approval 3 on the live page (ledger decision)", () => {
  for (const fixture of ["notFound404", "upstreamTimeout504"] as const) {
    test(`${fixture}: the error screen follows the approval-3 decision in the ledger`, async ({ page }) => {
      await openDeepLink(page, fixture);
      const card = resultCard(page);
      await expect(card).toHaveAttribute("data-failure-cause", /\w+/);
      const firstLink = page.locator('[data-cta-state="error"] a[href]').first();
      await expect(firstLink).toHaveAttribute("href", TALK_URL);
      const recovery = card.locator('[data-recovery] [data-slot="button"]');
      await expect(recovery.first()).toBeVisible();
      if (RESULT_APPROVALS.approval3) {
        // Spec §16 item 3 proposal: the cause's recovery action leads the card; 톡톡 stays the error block's first link.
        await expect(recovery.first()).toHaveAttribute("data-variant", "primary");
        await expect(firstLink).not.toHaveAttribute("data-variant", "primary");
      } else {
        // Roadmap §4 row 3 fallback: 톡톡 is the filled primary; [번호 수정]/[다시 조회] are secondary.
        await expect(firstLink).toHaveAccessibleName(TALK_NAME);
        await expect(firstLink).toHaveAttribute("data-variant", "primary");
        await expect(card.locator('[data-slot="button"][data-variant="primary"]')).toHaveCount(1);
        const variants = await recovery.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-variant")));
        expect(variants.every((variant) => variant === "secondary")).toBe(true);
      }
    });
  }
});

test.describe("pending help line (approval 4)", () => {
  test("pending: the help line after the purchase choices opens the order-check help", async ({ page }) => {
    const data = trackData("pending");
    const help = viewFor(success(data)).help.find((item) => item.id === "order-check");
    await openDeepLink(page, data);
    const line = page.locator('[data-cta-state="pending"] [data-help-link="order-check"]');
    await expect(line).toHaveText(help?.summary ?? "");
    await line.click();
    await expect(page.locator('[data-result-view] details[data-help="order-check"]')).toHaveAttribute("open", "");
  });
});
