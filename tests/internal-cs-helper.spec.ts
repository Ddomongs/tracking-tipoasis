import { expect, test } from "@playwright/test";
import { INTERNAL_TEST_CREDENTIALS } from "./internal-auth";

test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

test("internal helper generates a copy-ready delivery reply from an invoice", async ({ page }) => {
  await page.route("**/api/track", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          trackingNumber: "520671340641",
          type: "DOMESTIC",
          currentStatus: "배송중",
          currentStatusCode: 6,
          customs: { events: [] },
          delivery: {
            carrier: "CJ대한통운",
            carrierCode: "CJ",
            invoiceNumber: "520671340641",
            events: [
              {
                status: "배송중",
                statusCode: 6,
                datetime: "2026-05-31T08:30:00.000+09:00",
                location: "인천허브",
                detail: "간선상차"
              }
            ]
          },
          timeline: [],
          lastUpdated: "2026-05-31T08:30:00.000+09:00"
        }
      })
    });
  });

  await page.goto("/internal/cs-helper");
  await page.getByLabel("운송장번호").fill("520671340641");
  await page.getByRole("button", { name: "조회" }).click();

  await expect(page.getByText("CJ대한통운", { exact: true })).toBeVisible();
  await expect(page.getByText("520671340641").first()).toBeVisible();
  await expect(page.getByLabel("고객 안내문")).toContainText("현재 CJ대한통운 운송장번호 520671340641는 배송중 단계로 확인됩니다.");
  await expect(page.getByRole("button", { name: "복사" })).toBeVisible();
});

test("internal helper handles pending domestic invoices without saving a guide", async ({ page }) => {
  await page.route("**/api/track", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          trackingNumber: "520671340641",
          type: "DOMESTIC",
          currentStatus: "도착전",
          currentStatusCode: 1,
          isPending: true,
          customs: { events: [] },
          delivery: {
            carrier: "CJ대한통운",
            carrierCode: "CJ",
            invoiceNumber: "520671340641",
            events: []
          },
          timeline: [],
          lastUpdated: "2026-05-31T08:30:00.000+09:00"
        }
      })
    });
  });

  await page.goto("/internal/cs-helper");
  await page.getByLabel("운송장번호").fill("520671340641");
  await page.getByRole("button", { name: "조회" }).click();

  await expect(page.getByLabel("고객 안내문")).toContainText("아직 배송 이력이 확인되지 않습니다.");

  const savedRecords = await page.evaluate(() => window.localStorage.getItem("tracking-tipoasis:customs-mismatch-records"));
  expect(savedRecords).toBeNull();
});

test("internal helper stores customs mismatch drafts locally", async ({ page }) => {
  await page.goto("/internal/cs-helper");
  await page.getByRole("button", { name: "통관부호 불일치" }).click();

  await page.getByLabel("휴대폰 번호").fill("010-1234-5678");
  await page.getByLabel("운송장/주문 메모").fill("ORDER-1");
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText("010-1234-5678")).toBeVisible();
  await expect(page.getByText("ORDER-1", { exact: false })).toBeVisible();
  await expect(page.getByRole("article").getByText("개인통관고유부호 정보 확인이 필요합니다")).toBeVisible();
  await expect(page.getByRole("button", { name: "알림톡 준비중" })).toBeDisabled();

  await page.reload();
  await page.getByRole("button", { name: "통관부호 불일치" }).click();
  await expect(page.getByText("010-1234-5678")).toBeVisible();
});
