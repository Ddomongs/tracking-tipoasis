import { expect, test } from "@playwright/test";
import { INTERNAL_TEST_CREDENTIALS } from "./internal-auth";
import { MISMATCH_LEGACY_KEY } from "@/lib/cs/mismatch-storage";
import { FAKE, FIXTURE_NOW } from "./fixtures/tracking-fixtures";

test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

test("internal helper generates a copy-ready delivery reply from an invoice", async ({ page }) => {
  await page.route("**/api/track", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          trackingNumber: FAKE.domestic,
          type: "DOMESTIC",
          currentStatus: "배송중",
          currentStatusCode: 6,
          customs: { events: [] },
          delivery: {
            carrier: "CJ대한통운",
            carrierCode: "CJ",
            invoiceNumber: FAKE.domestic,
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
  await page.getByLabel("운송장번호").fill(FAKE.domestic);
  await page.getByRole("button", { name: "조회" }).click();

  await expect(page.getByText("CJ대한통운", { exact: true })).toBeVisible();
  await expect(page.getByText(FAKE.domestic).first()).toBeVisible();
  await expect(page.getByLabel("고객 안내문")).toContainText(`현재 CJ대한통운 운송장번호 ${FAKE.domestic}는 배송중 단계로 확인됩니다.`);
  await expect(page.getByRole("button", { name: "복사" })).toBeVisible();
});

test("internal helper handles pending domestic invoices without saving a guide", async ({ page }) => {
  await page.route("**/api/track", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          trackingNumber: FAKE.domestic,
          type: "DOMESTIC",
          currentStatus: "도착전",
          currentStatusCode: 1,
          isPending: true,
          customs: { events: [] },
          delivery: {
            carrier: "CJ대한통운",
            carrierCode: "CJ",
            invoiceNumber: FAKE.domestic,
            events: []
          },
          timeline: [],
          lastUpdated: "2026-05-31T08:30:00.000+09:00"
        }
      })
    });
  });

  await page.goto("/internal/cs-helper");
  await page.getByLabel("운송장번호").fill(FAKE.domestic);
  await page.getByRole("button", { name: "조회" }).click();

  await expect(page.getByLabel("고객 안내문")).toContainText("아직 배송 이력이 확인되지 않습니다.");

  const savedRecords = await page.evaluate(() => window.localStorage.getItem("tracking-tipoasis:customs-mismatch-records"));
  expect(savedRecords).toBeNull();
});

test("internal helper stores customs mismatch drafts locally", async ({ page }) => {
  await page.goto("/internal/cs-helper");
  await page.getByRole("button", { name: "통관부호 불일치" }).click();

  await page.getByLabel("휴대폰 번호").fill(FAKE.phone);
  await page.getByLabel("운송장/주문 메모").fill("ORDER-1");
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText(FAKE.phone)).toBeVisible();
  await expect(page.getByText("ORDER-1", { exact: false })).toBeVisible();
  await expect(page.getByRole("article").getByText("개인통관고유부호 정보 확인이 필요합니다")).toBeVisible();
  await expect(page.getByRole("button", { name: "알림톡 준비중" })).toBeDisabled();

  await page.reload();
  await page.getByRole("button", { name: "통관부호 불일치" }).click();
  await expect(page.getByText(FAKE.phone)).toBeVisible();
});

test("internal helper keeps mismatch drafts for 14 days and can clear them all", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const fresh = {
    id: "fresh",
    phone: FAKE.phone,
    content: "최근 안내",
    trackingMemo: "ORDER-2",
    templateKey: "default",
    createdAt: "2026-09-20T01:00:00.000Z"
  };
  const expired = { ...fresh, id: "expired", content: "오래된 안내", trackingMemo: "ORDER-OLD", createdAt: "2026-09-01T01:00:00.000Z" };

  await page.goto("/internal/cs-helper");
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
    MISMATCH_LEGACY_KEY,
    JSON.stringify([fresh, expired])
  ] as const);
  await page.reload();
  await page.getByRole("button", { name: "통관부호 불일치" }).click();

  await expect(page.getByText("ORDER-2", { exact: false })).toBeVisible();
  await expect(page.getByText("ORDER-OLD", { exact: false })).toHaveCount(0);
  await expect(page.getByText("이 브라우저에만 14일 동안 보관하고, 지나면 자동으로 지워요.")).toBeVisible();
  const migrated = await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_LEGACY_KEY);
  expect(JSON.parse(migrated ?? "null")).toMatchObject({ v: 1, records: [{ id: "fresh" }] });

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "전체 삭제", exact: true }).click();
  await expect(page.getByText("저장된 통관부호 불일치 안내가 없습니다.")).toBeVisible();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_LEGACY_KEY)).toBeNull();
});

test("internal helper still works when the browser refuses storage", async ({ page }) => {
  // Refuses only this tool's key, like a locked-down browser would; Next.js dev tooling keeps its own storage.
  await page.addInitScript((key) => {
    const refuse = (name: string): void => {
      if (name === key) throw new DOMException("storage is blocked", "SecurityError");
    };
    const { getItem, setItem, removeItem } = Storage.prototype;
    Storage.prototype.getItem = function (this: Storage, name: string): string | null {
      refuse(name);
      return getItem.call(this, name);
    };
    Storage.prototype.setItem = function (this: Storage, name: string, value: string): void {
      refuse(name);
      setItem.call(this, name, value);
    };
    Storage.prototype.removeItem = function (this: Storage, name: string): void {
      refuse(name);
      removeItem.call(this, name);
    };
  }, MISMATCH_LEGACY_KEY);

  await page.goto("/internal/cs-helper");
  await page.getByRole("button", { name: "통관부호 불일치" }).click();
  await expect(page.getByText("저장된 통관부호 불일치 안내가 없습니다.")).toBeVisible();

  await page.getByLabel("휴대폰 번호").fill(FAKE.phone);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("이 브라우저에서는 목록을 저장할 수 없어요. 내용 복사 버튼으로 옮겨 주세요.")).toBeVisible();
});
