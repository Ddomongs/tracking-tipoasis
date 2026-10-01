import { expect, test, type Locator, type Page } from "@playwright/test";
import { MISMATCH_KEEP_DAYS, MISMATCH_KEY, MISMATCH_LEGACY_KEY, MISMATCH_STATUS_LABELS } from "@/lib/cs/mismatch-storage";
import { CUSTOMS_MISMATCH_TEMPLATES } from "@/lib/cs/mismatch-templates";
import { maskPhone } from "@/lib/cs/phone-mask";
import { formatKstDateTime } from "@/lib/tracking/time";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import { FAKE, FIXTURE_NOW } from "../fixtures/tracking-fixtures";
import { copiedTexts, openDesk, recordClipboard } from "../support/internal-desk";

test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

const EMPTY_MESSAGE = "저장된 통관부호 불일치 안내가 없습니다.";
const STORAGE_REFUSED_MESSAGE = "이 브라우저에서는 목록을 저장할 수 없어요. 내용 복사 버튼으로 옮겨 주세요.";
/** Storage keys a locked-down browser refuses in the "refuses storage" test. */
const REFUSED_KEYS: readonly string[] = [MISMATCH_LEGACY_KEY, MISMATCH_KEY];
const KEEP_LABEL = "이 브라우저에 7일 보관";
const DAY_MS = 86_400_000;

const panel = (page: Page): Locator => page.locator('[data-internal-tab="mismatch"]');
const recordWith = (page: Page, memo: string): Locator => page.locator("[data-mismatch-record]").filter({ hasText: memo });

async function saveDraft(page: Page, memo: string): Promise<Locator> {
  await page.getByLabel("휴대폰 번호", { exact: true }).fill(FAKE.phone);
  await page.getByLabel("운송장/주문 메모", { exact: true }).fill(memo);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  const record = recordWith(page, memo);
  await expect(record).toBeVisible();
  return record;
}

test("a saved draft is listed with the masked phone, memo and template text and survives a reload", async ({ page }) => {
  await openDesk(page, "mismatch");
  const record = await saveDraft(page, "ORDER-1");
  await expect(record.getByText(maskPhone(FAKE.phone), { exact: true })).toBeVisible();
  await expect(record).toHaveAttribute("data-mismatch-status", "draft");
  await expect(record.getByText("개인통관고유부호 정보 확인이 필요합니다")).toBeVisible();
  await expect(page.getByText(FAKE.phone, { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("휴대폰 번호", { exact: true })).toHaveValue("");

  await page.reload();
  await expect(recordWith(page, "ORDER-1")).toBeVisible();
});

test("the tool never sends messages: a record offers copy, status and delete only", async ({ page }) => {
  await openDesk(page, "mismatch");
  const record = await saveDraft(page, "ORDER-2");
  await expect(record.getByRole("button")).toHaveText(["휴대폰 번호 복사", "안내 내용 복사", "삭제"]);
  await expect(record.getByRole("combobox", { name: "진행 상태" })).toBeVisible();
  await expect(panel(page).getByRole("button", { name: /알림톡|보내기|전송/ })).toHaveCount(0);
  await expect(panel(page).getByRole("link")).toHaveCount(0);
});

test("[휴대폰 번호 복사] copies the full number while the page shows it masked", async ({ page }) => {
  await recordClipboard(page);
  await openDesk(page, "mismatch");
  const record = await saveDraft(page, "ORDER-3");
  await record.getByRole("button", { name: "휴대폰 번호 복사", exact: true }).click();
  await expect.poll(() => copiedTexts(page)).toEqual([FAKE.phone]);
  await expect(record.getByRole("button", { name: "복사했어요", exact: true })).toBeVisible();
});

test("the status moves through 작성, 발송, 회신 and 완료 and is kept", async ({ page }) => {
  await openDesk(page, "mismatch");
  const record = await saveDraft(page, "ORDER-4");
  const status = record.getByRole("combobox", { name: "진행 상태" });
  await expect(status.locator("option")).toHaveText(Object.values(MISMATCH_STATUS_LABELS));
  for (const value of ["sent", "replied", "done"] as const) {
    await status.selectOption(value);
    await expect(record).toHaveAttribute("data-mismatch-status", value);
  }
  await page.reload();
  await expect(recordWith(page, "ORDER-4")).toHaveAttribute("data-mismatch-status", "done");
});

test("legacy drafts move into this tab's list, expired ones are dropped, and [전체 삭제] clears everything", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const fresh = {
    id: "fresh",
    phone: FAKE.phone,
    content: "최근 안내",
    trackingMemo: "ORDER-5",
    templateKey: "default",
    createdAt: "2026-09-20T01:00:00.000Z"
  };
  const expired = { ...fresh, id: "expired", content: "오래된 안내", trackingMemo: "ORDER-OLD", createdAt: "2026-09-01T01:00:00.000Z" };
  await openDesk(page, "mismatch");
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
    MISMATCH_LEGACY_KEY,
    JSON.stringify([fresh, expired])
  ] as const);
  await page.reload();

  await expect(recordWith(page, "ORDER-5")).toBeVisible();
  await expect(page.getByText("ORDER-OLD", { exact: false })).toHaveCount(0);
  await expect(page.locator("[data-mismatch-retention]")).toHaveAttribute("data-mismatch-retention", "session");
  const stored = await page.evaluate(
    ([legacyKey, key]) => ({
      legacy: window.localStorage.getItem(legacyKey),
      kept: window.localStorage.getItem(key),
      tab: window.sessionStorage.getItem(key)
    }),
    [MISMATCH_LEGACY_KEY, MISMATCH_KEY] as const
  );
  expect(stored.legacy).toBeNull();
  expect(stored.kept).toBeNull();
  expect(JSON.parse(stored.tab ?? "null")).toMatchObject({ v: 2, keepUntil: null, records: [{ id: "fresh", status: "draft" }] });

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "전체 삭제", exact: true }).click();
  await expect(page.getByText(EMPTY_MESSAGE)).toBeVisible();
  expect(await page.evaluate((key) => window.sessionStorage.getItem(key), MISMATCH_KEY)).toBeNull();
});

test("a browser that refuses storage still opens and explains why saving failed", async ({ page }) => {
  // Refuses only this tool's keys, like a locked-down browser would; Next.js dev tooling keeps its own storage.
  await page.addInitScript((keys) => {
    const refuse = (name: string): void => {
      if (keys.includes(name)) throw new DOMException("storage is blocked", "SecurityError");
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
  }, [...REFUSED_KEYS]);

  await openDesk(page, "mismatch");
  await expect(page.getByText(EMPTY_MESSAGE)).toBeVisible();
  await page.getByLabel("휴대폰 번호", { exact: true }).fill(FAKE.phone);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(panel(page).getByRole("alert")).toHaveText(STORAGE_REFUSED_MESSAGE);
});

test("a template choice fills the draft, and [내용 복사] copies it", async ({ page }) => {
  await recordClipboard(page);
  await openDesk(page, "mismatch");
  await page.getByLabel("안내 템플릿", { exact: true }).selectOption("hold");
  await expect(page.getByLabel("발송 예정 내용", { exact: true })).toHaveValue(CUSTOMS_MISMATCH_TEMPLATES.hold);
  await page.getByRole("button", { name: "내용 복사", exact: true }).click();
  await expect.poll(() => copiedTexts(page)).toEqual([CUSTOMS_MISMATCH_TEMPLATES.hold]);
});

test("a draft without a phone number is not saved", async ({ page }) => {
  await openDesk(page, "mismatch");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(panel(page).getByRole("alert")).toHaveText("휴대폰 번호와 안내 내용을 입력해주세요.");
  await expect(page.getByText(EMPTY_MESSAGE)).toBeVisible();
});

test("by default the list lives in this tab only", async ({ page, context }) => {
  await openDesk(page, "mismatch");
  await saveDraft(page, "ORDER-TAB");
  await expect(page.locator("[data-mismatch-retention]")).toHaveAttribute("data-mismatch-retention", "session");
  await expect(page.getByRole("checkbox", { name: KEEP_LABEL })).not.toBeChecked();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_KEY)).toBeNull();
  const other = await context.newPage();
  await openDesk(other, "mismatch");
  await expect(other.getByText(EMPTY_MESSAGE)).toBeVisible();
});

test("the 7-day keep moves the list into this browser until the date shown, and back", async ({ page, context }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await openDesk(page, "mismatch");
  await saveDraft(page, "ORDER-KEEP7");
  await page.getByRole("checkbox", { name: KEEP_LABEL }).check();
  await expect(page.locator("[data-mismatch-retention]")).toHaveAttribute("data-mismatch-retention", "kept");
  const keepUntil = new Date(FIXTURE_NOW.getTime() + MISMATCH_KEEP_DAYS * DAY_MS).toISOString();
  const kept = await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_KEY);
  expect(JSON.parse(kept ?? "null")).toMatchObject({ v: 2, keepUntil, records: [{ trackingMemo: "ORDER-KEEP7" }] });
  expect(await page.evaluate((key) => window.sessionStorage.getItem(key), MISMATCH_KEY)).toBeNull();
  await expect(page.locator("[data-mismatch-retention]")).toContainText(formatKstDateTime(new Date(keepUntil)));

  const other = await context.newPage();
  await other.clock.setFixedTime(FIXTURE_NOW);
  await openDesk(other, "mismatch");
  await expect(recordWith(other, "ORDER-KEEP7")).toBeVisible();
  await other.close();

  await page.getByRole("checkbox", { name: KEEP_LABEL }).uncheck();
  await expect(page.locator("[data-mismatch-retention]")).toHaveAttribute("data-mismatch-retention", "session");
  expect(await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_KEY)).toBeNull();
  await expect(recordWith(page, "ORDER-KEEP7")).toBeVisible();
});

test("a kept list is deleted once its 7 days are over", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const old = {
    id: "kept-old",
    phone: FAKE.phone,
    content: "지난 안내",
    trackingMemo: "ORDER-EXPIRED",
    templateKey: "default",
    status: "sent",
    createdAt: "2026-09-10T01:00:00.000Z"
  };
  await openDesk(page, "mismatch");
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [
    MISMATCH_KEY,
    JSON.stringify({ v: 2, keepUntil: "2026-09-20T00:00:00.000Z", records: [old] })
  ] as const);
  await page.reload();
  await expect(page.getByText(EMPTY_MESSAGE)).toBeVisible();
  expect(await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_KEY)).toBeNull();
});
