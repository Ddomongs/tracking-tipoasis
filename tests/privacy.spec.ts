import { expect, test } from "@playwright/test";

test("privacy policy is reachable from the footer and explains the no-storage rule", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute("href", "/privacy");

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("개인정보처리방침");
  await expect(page.getByText("입력한 번호와 조회 결과는 서버 데이터베이스에 저장하지 않습니다.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "톡톡으로 문의하기" })).toHaveAttribute("target", "_blank");
});

test("a stale shipment shows a verification prompt instead of a delivery estimate", async ({ page }) => {
  await page.route("**/api/track", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          trackingNumber: "509493884901",
          type: "DOMESTIC",
          currentStatus: "통관완료",
          currentStatusCode: 4,
          estimateStale: true,
          estimatedCustomsClearanceDate: "2026-02-13T12:00:00+09:00",
          customs: {
            events: [{ status: "통관완료", statusCode: 4, datetime: "2026-02-13T12:00:00+09:00" }]
          },
          delivery: { carrier: "국내택배 자동 조회", carrierCode: "AUTO", invoiceNumber: "509493884901", events: [] },
          timeline: [],
          lastUpdated: "2026-02-13T12:00:00+09:00"
        }
      })
    });
  });

  await page.goto("/509493884901");

  const summary = page.locator('[data-tracking-result-summary="true"]');
  await expect(summary.getByText("배송 이력 확인 필요")).toBeVisible();
  await expect(summary.getByText("확인 필요", { exact: true })).toBeVisible();
  await expect(summary.getByText("오늘 예상")).toHaveCount(0);
  await expect(summary.getByText("마지막 처리 이후 오래 지났습니다", { exact: false })).toBeVisible();
});
