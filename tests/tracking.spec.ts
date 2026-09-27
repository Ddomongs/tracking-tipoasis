import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { TrackRequestSchema } from "@/lib/schemas";
import { normalizeTrackingData } from "@/lib/services/normalizer";
import { deriveStatusView } from "@/components/status-slot/status-view";
import { channels, disclosures } from "@/config/site.config";
import type { TrackingViewModel } from "@/lib/tracking/types";
import type { StatusCode, TrackResponseData } from "@/lib/types";
import { FAKE, FIXTURE_NOW, mockTrack } from "./fixtures/tracking-fixtures";

type MockTrackingState = {
  readonly status: string;
  readonly code: StatusCode;
  readonly isPending: boolean;
};

const trackingTimeline: TrackResponseData["timeline"] = [
  { step: 1, label: "입항", completed: false },
  { step: 2, label: "통관 접수", completed: false },
  { step: 3, label: "통관 심사중", completed: false },
  { step: 4, label: "통관 완료", completed: false },
  { step: 5, label: "국내 배송 인계", completed: false },
  { step: 6, label: "배송중", completed: false },
  { step: 7, label: "배송완료", completed: false }
];

/** `now` defaults to the real clock; the state tests pass the instant they pin the page clock to, so Node derives the same view. */
const createTrackData = (state: MockTrackingState, now: Date = new Date()): TrackResponseData => {
  const estimatedDeliveryDate = new Date(now.getTime());
  if (state.code !== 7) estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 3);
  const estimatedCustomsClearanceDate = new Date(now.getTime());
  estimatedCustomsClearanceDate.setDate(estimatedCustomsClearanceDate.getDate() - 1);

  return {
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    currentStatus: state.status,
    currentStatusCode: state.code,
    isPending: state.isPending,
    estimatedCustomsClearanceDate: state.isPending ? undefined : estimatedCustomsClearanceDate.toISOString(),
    estimatedDeliveryDate: estimatedDeliveryDate.toISOString(),
    customs: { events: [] },
    delivery: {
      carrier: "CJ대한통운",
      carrierCode: "CJ",
      invoiceNumber: FAKE.domestic,
      events: []
    },
    timeline: trackingTimeline.map((step) => ({
      ...step,
      completed: step.step <= state.code
    })),
    lastUpdated: now.toISOString()
  };
};

/** The view the status slot renders for a manual lookup of `data` settled at `now` (approval 2: the rules are asserted through it). */
const resultView = (data: TrackResponseData, now: Date): TrackingViewModel =>
  deriveStatusView({ kind: "success", request: { number: data.trackingNumber, carrier: "AUTO", entry: "manual" }, data }, now);

/** Every store link the config can place (naver and coupang, all placements). */
const STORE_LINKS = [...new Set([...Object.values(channels.naver.urls), ...Object.values(channels.coupang.urls)])]
  .map((href) => `a[href="${href}"]`)
  .join(", ");

/** Spec §8: inside a CTA block the affiliate disclosure comes before the first sponsored link. */
const disclosureComesFirst = (page: Page, ctaState: string): Promise<boolean> =>
  page.evaluate((state) => {
    const block = document.querySelector(`[data-cta-state="${state}"]`);
    const disclosure = block?.querySelector("[data-affiliate-disclosure]") ?? null;
    const sponsored = block?.querySelector('a[rel~="sponsored"]') ?? null;
    return (
      disclosure !== null &&
      sponsored !== null &&
      (disclosure.compareDocumentPosition(sponsored) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    );
  }, ctaState);
test("normalizer calculates a clear customs completion estimate while customs is waiting", () => {
  const data = normalizeTrackingData({
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    customsEvents: [
      {
        status: "통관목록접수",
        statusCode: 2,
        datetime: "2026-07-13T10:17:07+09:00"
      }
    ],
    deliveryLookup: {
      carrier: "국내택배 자동 조회",
      carrierCode: "AUTO",
      events: []
    },
    now: new Date("2026-07-13T12:00:00+09:00")
  });

  expect(data.currentStatusCode).toBe(2);
  expect(data.estimatedCustomsClearanceDate).toBe("2026-07-14T01:17:07.000Z");
});

test("tracking result leads with delivery date and keeps customs estimate secondary", async ({ page }) => {
  const data = normalizeTrackingData({
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    customsEvents: [
      {
        status: "통관목록접수",
        statusCode: 2,
        datetime: "2026-07-13T10:17:07+09:00"
      }
    ],
    deliveryLookup: {
      carrier: "국내택배 자동 조회",
      carrierCode: "AUTO",
      events: []
    },
    now: new Date("2026-07-13T12:00:00+09:00")
  });

  await page.route("**/api/track", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  });
  await page.clock.setFixedTime(new Date("2026-07-13T12:00:00+09:00"));
  await page.goto("/");
  await page.getByLabel("조회번호 (HBL 또는 운송장)", { exact: true }).fill(FAKE.domestic);
  await page.getByRole("button", { name: "조회하기" }).click();

  const summary = page.locator('[data-status-slot="settled"]');
  const deliveryEstimate = summary.locator("[data-eta-kind]");
  const view = resultView(data, new Date("2026-07-13T12:00:00+09:00"));
  // 7/17 is 제헌절 in S03's 2026 calendar, so the estimate carries the holiday badge (kind "holidayAffected", no D-n).
  if (view.eta.kind !== "date" && view.eta.kind !== "holidayAffected") throw new Error(`unexpected ETA kind ${view.eta.kind}`);
  expect(view.eta.date.key).toBe("2026-07-17");
  expect(view.eta.caption ?? "").toContain("7월 14일");
  await expect(summary.locator("[data-guide-key]").getByRole("heading", { level: 2 })).toHaveText(view.title);
  await expect(deliveryEstimate).toHaveAttribute("data-eta-kind", view.eta.kind);
  await expect(deliveryEstimate.getByText(view.eta.label, { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(view.eta.date.label, { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(view.eta.caption ?? "", { exact: true })).toBeVisible();
  await expect(summary.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();
  await expect(summary.getByRole("list", { name: "배송 여정 4구간" }).locator('[aria-current="step"]')).toHaveCount(1);
  await expect(summary.getByText("전체 진행 단계", { exact: true })).toHaveCount(0);
});

test("an overdue customs estimate is recalculated and remains readable on mobile", async ({ page }) => {
  const data = normalizeTrackingData({
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    customsEvents: [
      {
        status: "통관목록접수",
        statusCode: 2,
        datetime: "2026-07-16T10:31:53+09:00"
      }
    ],
    deliveryLookup: {
      carrier: "국내택배 자동 조회",
      carrierCode: "AUTO",
      events: []
    },
    now: new Date("2026-07-20T12:00:00+09:00")
  });

  await page.route("**/api/track", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  });
  await page.clock.setFixedTime(new Date("2026-07-20T12:00:00+09:00"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("조회번호 (HBL 또는 운송장)", { exact: true }).fill(FAKE.domestic);
  await page.getByRole("button", { name: "조회하기" }).click();

  const summary = page.locator('[data-status-slot="settled"]');
  const view = resultView(data, new Date("2026-07-20T12:00:00+09:00"));
  await expect(summary.locator("[data-guide-key]").getByRole("heading", { level: 2 })).toHaveText(view.title);
  await expect(summary.getByText("7월 23일 (목)")).toBeVisible();
  await expect(summary.getByText("7월 20일 (월)")).toBeVisible();
  await expect(summary.getByText("7월 17일 (금)")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("pickup status names the carrier pickup and prioritizes the delivery estimate", async ({ page }) => {
  const data: TrackResponseData = {
    ...createTrackData({ status: "집화처리", code: 5, isPending: false }),
    estimatedCustomsClearanceDate: "2026-07-14T06:10:32.000Z",
    estimatedDeliveryDate: "2026-07-16T06:10:32.000Z",
    delivery: {
      carrier: "CJ대한통운",
      carrierCode: "CJ",
      invoiceNumber: FAKE.domestic,
      events: [
        {
          status: "집화처리",
          statusCode: 5,
          datetime: "2026-07-14T06:11:54.000Z",
          detail: "보내시는 고객님으로부터 상품을 인수받았습니다"
        }
      ]
    }
  };

  await page.route("**/api/track", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  });
  // The client judges stale and overdue with its own clock when a result settles (spec §6): pin it to the fixture's day.
  await page.clock.setFixedTime(new Date("2026-07-14T16:00:00+09:00"));
  await submitTracking(page);

  const summary = page.locator('[data-status-slot="settled"]');
  const deliveryEstimate = summary.locator("[data-eta-kind]");
  const view = resultView(data, new Date("2026-07-14T16:00:00+09:00"));
  if (view.eta.kind !== "date") throw new Error(`unexpected ETA kind ${view.eta.kind}`);
  expect(view.eta.date.key).toBe("2026-07-16");
  expect(view.eta.caption ?? "").toContain("7월 14일");
  expect(view.title).toContain("CJ대한통운");
  await expect(summary.locator("[data-guide-key]").getByRole("heading", { level: 2 })).toHaveText(view.title);
  await expect(summary.getByText(view.reason ?? "", { exact: true })).toBeVisible();
  await expect(summary.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(view.eta.label, { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(view.eta.date.label, { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(view.eta.caption ?? "", { exact: true })).toBeVisible();
});

const submitTracking = async (page: Page): Promise<void> => {
  await page.goto("/");
  await page.getByLabel("조회번호 (HBL 또는 운송장)", { exact: true }).fill(FAKE.domestic);
  await page.getByRole("button", { name: "조회하기" }).click();
};

test("user can choose a representative domestic carrier before tracking", async ({ page }) => {
  await page.route("**/api/track", async (route) => {
    const body = TrackRequestSchema.parse(route.request().postDataJSON());
    expect(body).toEqual({ trackingNumber: FAKE.domestic, carrierCode: "HANJIN" });

    const data = createTrackData({ status: "배송중", code: 6, isPending: false });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          ...data,
          trackingNumber: body.trackingNumber,
          delivery: {
            ...data.delivery,
            carrier: "한진택배",
            carrierCode: body.carrierCode,
            invoiceNumber: body.trackingNumber,
            trackingUrl:
              `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${FAKE.domestic}`
          }
        }
      })
    });
  });

  await page.goto("/");
  const carrier = page.getByRole("combobox", { name: "국내 택배사" });
  await expect(carrier).toBeVisible();
  await expect(carrier.locator("option")).toHaveText([
    "자동으로 찾기",
    "CJ대한통운",
    "우체국택배",
    "한진택배",
    "롯데택배",
    "로젠택배"
  ]);

  await carrier.selectOption("HANJIN");
  await page.getByLabel("조회번호 (HBL 또는 운송장)", { exact: true }).fill(FAKE.domestic);
  await page.getByRole("button", { name: "조회하기" }).click();

  await expect(page.getByRole("region", { name: "배송 조회 결과" }).getByText("한진택배", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "한진택배 공식 배송조회 새 창으로 열기" })).toBeVisible();
  const skipLinkState = await page.getByRole("link", { name: "본문으로 건너뛰기" }).evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    active: document.activeElement === element
  }));
  expect(skipLinkState.active).toBe(false);
  expect(skipLinkState.top).toBeLessThan(0);
});

test("home offers transparent storefront choices without interrupting tracking", async ({ page }) => {
  await page.goto("/");

  const storefront = page.locator('[data-storefront-showcase="true"]');
  await expect(storefront.getByRole("heading", { name: "새로운 상품을 찾고 계신가요?" })).toBeVisible();
  await expect(storefront.getByRole("link", { name: "네이버 스토어 상품 보기 새 창으로 열기" })).toBeVisible();
  await expect(storefront.getByRole("link", { name: "쿠팡 스토어 상품 보기 새 창으로 열기" })).toBeVisible();
  await expect(
    storefront.getByText("일부 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.")
  ).toBeVisible();
});

test("error state prioritizes inquiry without store promotion", async ({ page }) => {
  await page.route("**/api/track", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        error: { code: "NOT_FOUND", message: "조회 정보를 찾을 수 없습니다." }
      })
    });
  });

  await submitTracking(page);

  const cta = page.locator('[data-cta-state="error"]');
  await expect(cta.getByRole("heading", { name: "조회가 잘되지 않나요?" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "톡톡으로 문의하기 새 창으로 열기" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toHaveCount(0);
});

test("pending state offers inquiry and purchase-channel choices", async ({ page }) => {
  const data = createTrackData({ status: "도착전", code: 1, isPending: true }, FIXTURE_NOW);
  const view = resultView(data, FIXTURE_NOW);
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, data);
  await submitTracking(page);

  const cta = page.locator('[data-cta-state="pending"]');
  const summary = page.locator('[data-status-slot="settled"]');
  if (view.eta.kind !== "pendingInfo") throw new Error(`unexpected ETA kind ${view.eta.kind}`);
  const stores = view.nextAction.stores;
  if (stores === null) throw new Error("pending must offer the purchase choices");
  if (view.nextAction.note === null) throw new Error("pending must show the recheck sentence");
  expect(stores.links.some((link) => link.isAffiliate)).toBe(true);
  await expect(summary.locator("[data-guide-key]").getByRole("heading", { level: 2 })).toHaveText(view.title);
  await expect(summary.locator('[data-eta-kind="pendingInfo"]').getByText(view.eta.text, { exact: true })).toBeVisible();
  await expect(cta.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();
  await expect(cta.getByText(view.nextAction.note, { exact: true })).toBeVisible();
  await expect(cta.getByRole("heading", { level: 3 })).toHaveText(view.nextAction.heading ?? "");
  await expect(cta.getByRole("link", { name: `${channels.talk.labels.cta} 새 창으로 열기` })).toBeVisible();
  for (const link of stores.links) {
    const storeLink = cta.getByRole("link", { name: `${link.label} 새 창으로 열기` });
    await expect(storeLink).toHaveAttribute("href", link.href);
    if (link.isAffiliate) await expect(storeLink).toHaveAttribute("rel", /sponsored/);
    else await expect(storeLink).not.toHaveAttribute("rel", /sponsored/);
  }
  await expect(cta.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
  expect(await disclosureComesFirst(page, "pending")).toBe(true);
  const recommendations = page.locator('[data-recommended-products="pending"]');
  const bestTrigger = recommendations.getByRole("button", { name: "금주의 베스트 리뷰 상품 간략히 보기" });
  await expect(bestTrigger).toBeVisible();
  await bestTrigger.click();
  const bestDialog = page.getByRole("dialog", { name: "금주의 베스트 리뷰 상품" });
  await expect(bestDialog).toBeVisible();
  await expect(bestDialog.getByText("해외 구매대행으로 주문했는데 포장 상태가 깔끔하게 와서 만족했습니다.")).toBeVisible();
  await expect(bestDialog.getByRole("link", { name: "Carpodgo mini 6.99인치 카플레이 판매처에서 찾기 새 창으로 열기" })).toBeVisible();
  await expect(bestDialog.getByRole("link", { name: "SVBONY 천체 망원경 접안 렌즈 판매처에서 찾기 새 창으로 열기" })).toHaveAttribute("rel", /sponsored/);
  await bestDialog.getByRole("button", { name: "금주의 베스트 상품 팝업 닫기" }).click();
  await expect(bestDialog).toHaveCount(0);
  await expect(page.getByText("배송현황은 스토어에 문의하세요 -> 스토어 바로가기")).toHaveCount(0);
});

test("in-transit state keeps shopping links out of the primary flow", async ({ page }) => {
  const data = createTrackData({ status: "배송중", code: 6, isPending: false }, FIXTURE_NOW);
  const view = resultView(data, FIXTURE_NOW);
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, data);
  await submitTracking(page);

  const cta = page.locator('[data-cta-state="inTransit"]');
  const summary = page.locator('[data-status-slot="settled"]');
  if (view.eta.kind === "none") throw new Error("in transit must show an arrival estimate");
  expect(view.nextAction.stores).toBeNull();
  await expect(summary.locator("[data-guide-key]").getByRole("heading", { level: 2 })).toHaveText(view.title);
  await expect(summary.locator("[data-eta-kind]").getByText(view.eta.label, { exact: true })).toBeVisible();
  await expect(cta.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();
  await expect(summary.locator('[data-station="domestic"]')).toHaveAttribute("aria-current", "step");
  await expect(cta.getByRole("heading", { level: 3 })).toHaveText(view.nextAction.heading ?? "");
  await expect(cta.getByRole("link", { name: `${channels.talk.labels.cta} 새 창으로 열기` })).toBeVisible();
  await expect(cta.locator(STORE_LINKS)).toHaveCount(0);
  await expect(cta.locator('a[rel~="sponsored"]')).toHaveCount(0);
  await expect(page.locator("#tracking-panel [data-recommended-products]")).toHaveCount(0);
  await expect(page.locator('[data-recommended-products="inTransit"]')).toBeVisible();
  await expect(page.locator('[data-motion-cue="weekly-best"]')).toBeVisible();
});

test("delivered state leads with store choices", async ({ page }) => {
  const data = createTrackData({ status: "배송완료", code: 7, isPending: false }, FIXTURE_NOW);
  const view = resultView(data, FIXTURE_NOW);
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, data);
  await submitTracking(page);

  const cta = page.locator('[data-cta-state="delivered"]');
  const summary = page.locator('[data-status-slot="settled"]');
  if (view.eta.kind !== "deliveredOn") throw new Error(`unexpected ETA kind ${view.eta.kind}`);
  const stores = view.nextAction.stores;
  if (stores === null) throw new Error("delivered must lead with the stores");
  await expect(summary.locator("[data-guide-key]").getByRole("heading", { level: 2 })).toHaveText(view.title);
  await expect(summary.locator('[data-eta-kind="deliveredOn"]').getByText(view.eta.label, { exact: true })).toBeVisible();
  await expect(cta.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();
  await expect(cta.getByRole("heading", { level: 3 })).toHaveText(view.nextAction.heading ?? "");
  const firstTwo = await cta.getByRole("link").evaluateAll((links) => links.slice(0, 2).map((link) => link.getAttribute("href")));
  expect(firstTwo).toEqual(stores.links.map((link) => link.href));
  await expect(cta.getByRole("link", { name: `${channels.talk.labels.cta} 새 창으로 열기` })).toBeVisible();
  await expect(cta.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
  expect(await disclosureComesFirst(page, "delivered")).toBe(true);
  await expect(page.locator('[data-recommended-products="delivered"]')).toBeVisible();
});
