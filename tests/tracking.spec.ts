import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { TrackRequestSchema } from "@/lib/schemas";
import { normalizeTrackingData } from "@/lib/services/normalizer";
import type { StatusCode, TrackResponseData } from "@/lib/types";

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

const createTrackData = (state: MockTrackingState): TrackResponseData => {
  const estimatedDeliveryDate = new Date();
  if (state.code !== 7) estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 3);
  const estimatedCustomsClearanceDate = new Date();
  estimatedCustomsClearanceDate.setDate(estimatedCustomsClearanceDate.getDate() - 1);

  return {
    trackingNumber: "520671340641",
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
      invoiceNumber: "520671340641",
      events: []
    },
    timeline: trackingTimeline.map((step) => ({
      ...step,
      completed: step.step <= state.code
    })),
    lastUpdated: new Date().toISOString()
  };
};

test("normalizer calculates a clear customs completion estimate while customs is waiting", () => {
  const data = normalizeTrackingData({
    trackingNumber: "305912495223",
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
    trackingNumber: "305912495223",
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
  await page.getByLabel("조회번호 (HBL 또는 운송장)", { exact: true }).fill("305912495223");
  await page.getByRole("button", { name: "조회하기" }).click();

  const summary = page.locator('[data-tracking-result-summary="true"]');
  const deliveryEstimate = summary.locator('[data-delivery-estimate="true"]');
  await expect(summary.getByRole("heading", { name: "통관대기" })).toBeVisible();
  await expect(deliveryEstimate.getByText("배송 완료 예상일", { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(/7월 17일/)).toBeVisible();
  const customsEstimate = deliveryEstimate.locator('[data-customs-estimate="true"]');
  await expect(customsEstimate.getByText("통관완료 예상일", { exact: true })).toBeVisible();
  await expect(customsEstimate.getByText(/7월 14일/)).toBeVisible();
  await expect(summary.getByText("정상 통관 대기 상태입니다. 지금은 별도 문의 없이 조금만 기다려 주세요.")).toBeVisible();
  await expect(summary.getByText("전체 흐름 한눈에 보기", { exact: true })).toBeVisible();
  await expect(summary.getByText("전체 진행 단계", { exact: true })).toHaveCount(0);
});

test("an overdue customs estimate is recalculated and remains readable on mobile", async ({ page }) => {
  const data = normalizeTrackingData({
    trackingNumber: "305912548213",
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
  await page.getByRole("dialog", { name: "상담·스토어 바로가기" }).getByRole("button", { name: "상담과 스토어 팝업 닫기" }).click();
  await page.getByLabel("조회번호 (HBL 또는 운송장)", { exact: true }).fill("305912548213");
  await page.getByRole("button", { name: "조회하기" }).click();

  const summary = page.locator('[data-tracking-result-summary="true"]');
  await expect(summary.getByRole("heading", { name: "통관대기" })).toBeVisible();
  await expect(summary.getByText("7월 23일 (목)")).toBeVisible();
  await expect(summary.getByText("7월 20일 (월)")).toBeVisible();
  await expect(summary.getByText("오늘 예상")).toBeVisible();
  await expect(summary.getByText("현재 통관 상태를 반영해 예상일을 다시 계산했습니다.")).toBeVisible();
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
      invoiceNumber: "520671340641",
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
  await submitTracking(page);

  const summary = page.locator('[data-tracking-result-summary="true"]');
  const deliveryEstimate = summary.locator('[data-delivery-estimate="true"]');
  await expect(summary.getByRole("heading", { name: "CJ대한통운 기사님 픽업 완료!" })).toBeVisible();
  await expect(summary.getByText("CJ대한통운 기사님이 상품을 인수해 배송 출발을 준비하고 있습니다.")).toBeVisible();
  await expect(summary.getByText("픽업이 완료됐습니다. 배송 이동이 시작되면 현재 위치가 업데이트됩니다.")).toBeVisible();
  await expect(deliveryEstimate.getByText("배송 완료 예상일", { exact: true })).toBeVisible();
  await expect(deliveryEstimate.getByText(/7월 16일/)).toBeVisible();
  const customsEstimate = deliveryEstimate.locator('[data-customs-estimate="true"]');
  await expect(customsEstimate.getByText("통관 완료일", { exact: true })).toBeVisible();
  await expect(customsEstimate.getByText(/7월 14일/)).toBeVisible();
});

const mockTrackSuccess = async (page: Page, state: MockTrackingState): Promise<void> => {
  await page.route("**/api/track", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: createTrackData(state) })
    });
  });
};

const submitTracking = async (page: Page): Promise<void> => {
  await page.goto("/");
  await page.getByLabel("조회번호 (HBL 또는 운송장)", { exact: true }).fill("520671340641");
  await page.getByRole("button", { name: "조회하기" }).click();
};

test("home uses customer language without brand, robot, or AI copy", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("구매 고객을 위한 배송조회")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "통관부터 국내 배송까지 한 번에 확인" })).toBeVisible();
  const logisticsFlow = page.locator('[data-logistics-flow="true"]');
  await expect(logisticsFlow).toBeVisible();
  await expect(logisticsFlow.locator('[data-motion-visual="route"]')).toBeVisible();
  await expect(page.getByRole("region", { name: "배송 조회 안심 안내" }).locator('[data-motion-visual="lookup"]')).toBeVisible();
  await expect(page.getByText("실시간 AI 배송 추적 시스템")).toHaveCount(0);
  await expect(page.locator('iframe[src*="spline.design"]')).toHaveCount(0);
  await expect(page.locator("body")).toHaveClass(/google-anno-skip/);
  await expect(page.getByLabel("조회번호 (HBL 또는 운송장)", { exact: true })).toBeVisible();
  const trackingInput = page.getByRole("textbox", { name: "조회번호 (HBL 또는 운송장)", exact: true });
  await expect(trackingInput).toBeVisible();
  await expect(trackingInput).toHaveAttribute("data-input-shake", "active");
  await expect(page.getByText("운송장 번호는 바로 아래 칸에 넣어 주세요!")).toBeVisible();
  await expect(page.locator('[data-motion-cue="tracking-input-pointer"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "조회하기" })).toBeVisible();
  await expect(page.locator('[data-motion-cue="tracking-submit"]')).toBeVisible();
  await trackingInput.fill("509493884901");
  await expect(trackingInput).toHaveAttribute("data-input-shake", "idle");
});

test("user can choose a representative domestic carrier before tracking", async ({ page }) => {
  await page.route("**/api/track", async (route) => {
    const body = TrackRequestSchema.parse(route.request().postDataJSON());
    expect(body).toEqual({ trackingNumber: "459384817824", carrierCode: "HANJIN" });

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
              "https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=459384817824"
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
  await page.getByLabel("조회번호 (HBL 또는 운송장)", { exact: true }).fill("459384817824");
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

test("semantic motion is finite and honors reduced-motion", async ({ page }) => {
  await page.goto("/");

  const routeIcon = page.locator('[data-logistics-flow="true"] [data-motion-visual="route"] .motion-visual-icon');
  const routeMotion = await routeIcon.evaluate((element) => {
    const style = getComputedStyle(element);
    return { name: style.animationName, iterations: style.animationIterationCount };
  });
  expect(routeMotion.name).toContain("visual-route");
  expect(routeMotion.iterations).toBe("2");

  const storeIcon = page.locator('[data-motion-visual="store"] .motion-visual-icon').first();
  await expect(storeIcon).toBeVisible();
  await expect(storeIcon).toHaveCSS("animation-name", "none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(routeIcon).toHaveCSS("animation-name", "none");
  await expect(page.locator(".motion-logistics-packet")).toHaveCSS("animation-name", "none");
});

for (const viewport of [
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 }
] as const) {
  test(`${viewport.name} layout keeps motion inside the viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator('[data-logistics-flow="true"]')).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflow).toBe(false);
  });
}

test("mobile first view exposes consultation and store shortcuts", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const popup = page.getByRole("dialog", { name: "상담·스토어 바로가기" });
  await expect(popup).toBeVisible();
  await expect(popup.getByRole("link", { name: "상담사에게 톡톡 문의하기 새 창으로 열기" })).toBeVisible();
  await expect(popup.getByRole("link", { name: "네이버 스토어 바로가기 새 창으로 열기" })).toBeVisible();
  await expect(popup.getByRole("link", { name: "쿠팡 스토어 바로가기 새 창으로 열기" })).toBeVisible();

  await popup.getByRole("button", { name: "상담과 스토어 팝업 닫기" }).click();
  const reopenButton = page.getByRole("button", { name: "상담과 스토어 바로가기 다시 열기" });
  await expect(reopenButton).toBeVisible();
  await reopenButton.click();
  await expect(popup).toBeVisible();
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
  await expect(page.getByRole("dialog", { name: "문의와 상품 확인을 바로 시작하세요" })).toBeVisible();
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
  await mockTrackSuccess(page, { status: "도착전", code: 1, isPending: true });
  await submitTracking(page);

  const cta = page.locator('[data-cta-state="pending"]');
  const summary = page.locator('[data-tracking-result-summary="true"]');
  await expect(summary.getByRole("heading", { name: "통관 정보 등록 전" })).toBeVisible();
  await expect(summary.getByText("정보 등록 후 안내", { exact: true })).toBeVisible();
  await expect(summary.getByText("정보 반영까지 시간이 걸릴 수 있어 2~3시간 뒤 다시 확인해 주세요.")).toBeVisible();
  await expect(cta.getByRole("heading", { name: "아직 국내 배송 정보가 없어요" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "톡톡으로 문의하기 새 창으로 열기" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toBeVisible();
  const coupangLink = cta.getByRole("link", { name: "쿠팡 스토어 보기 새 창으로 열기" });
  await expect(coupangLink).toBeVisible();
  await expect(coupangLink).toHaveAttribute("rel", /sponsored/);
  await expect(
    cta.getByText("쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.")
  ).toBeVisible();
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
  await mockTrackSuccess(page, { status: "배송중", code: 6, isPending: false });
  await submitTracking(page);

  const cta = page.locator('[data-cta-state="inTransit"]');
  const summary = page.locator('[data-tracking-result-summary="true"]');
  await expect(summary.getByRole("heading", { name: "국내 배송 중" })).toBeVisible();
  await expect(summary.getByText("배송 완료 예상일", { exact: true })).toBeVisible();
  await expect(summary.getByText("배송 중입니다. 문자로 안내된 배송 예정 시간을 확인해 주세요.")).toBeVisible();
  await expect(summary.locator('[data-motion-visual="result"]')).toBeVisible();
  await expect(summary.getByRole("link", { name: "기타 문의는 톡톡으로 문의하기 새 창으로 열기" })).toBeVisible();
  await expect(summary.getByRole("list", { name: "배송 진행 구간" }).getByText("국내 배송", { exact: true })).toBeVisible();
  await expect(cta.getByRole("heading", { name: "배송이 진행 중이에요" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "톡톡으로 문의하기 새 창으로 열기" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toHaveCount(0);
  await expect(cta.getByRole("link", { name: "쿠팡 스토어 보기 새 창으로 열기" })).toHaveCount(0);
  await expect(page.locator('[data-recommended-products="inTransit"]')).toBeVisible();
  await expect(page.locator('[data-motion-cue="weekly-best"]')).toBeVisible();
});

test("delivered state leads with store choices", async ({ page }) => {
  await mockTrackSuccess(page, { status: "배송완료", code: 7, isPending: false });
  await submitTracking(page);

  const cta = page.locator('[data-cta-state="delivered"]');
  const summary = page.locator('[data-tracking-result-summary="true"]');
  await expect(summary.getByRole("heading", { name: "배송 완료" })).toBeVisible();
  await expect(summary.getByText("배송 완료일", { exact: true })).toBeVisible();
  await expect(summary.getByText("배송이 완료됐습니다. 상품 상태를 확인해 주세요.")).toBeVisible();
  await expect(cta.getByRole("heading", { name: "배송이 완료됐어요" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "네이버 스토어 보기 새 창으로 열기" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "쿠팡 스토어 보기 새 창으로 열기" })).toBeVisible();
  await expect(cta.getByRole("link", { name: "톡톡으로 문의하기 새 창으로 열기" })).toBeVisible();
  await expect(
    cta.getByText("쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.")
  ).toBeVisible();
  await expect(page.locator('[data-recommended-products="delivered"]')).toBeVisible();
});
