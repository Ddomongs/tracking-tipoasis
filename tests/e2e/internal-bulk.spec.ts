import { expect, test, type Locator, type Page } from "@playwright/test";
import { deriveResultView } from "@/components/result/approvals";
import { siteConfig } from "@/config/site.config";
import { BULK_MAX, BULK_MIN_INTERVAL_MS, TONE_LABELS, sortBulkRows, type BulkRow } from "@/lib/cs/bulk-lookup";
import { buildCsReply, type CsReply } from "@/lib/cs/cs-reply";
import { MISMATCH_LEGACY_KEY } from "@/lib/cs/mismatch-storage";
import { maskPhone } from "@/lib/cs/phone-mask";
import { buildInquiryCopy } from "@/lib/tracking/inquiry-copy";
import type { FailureCause, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import { customsWaitingData, deliveredData, pendingData } from "../fixtures/derive-scenarios";
import { FAILURE_RESPONSES, FAKE, FAKE_GROUPED, FIXTURE_NOW, successBody, type FailureFixture } from "../fixtures/tracking-fixtures";
import { blockClipboard, copiedTexts, openDesk, recordClipboard, recordTrackStarts, trackStarts } from "../support/internal-desk";

test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

const INPUT_LABEL = `조회번호 (한 줄에 하나, 최대 ${BULK_MAX}건)`;
const SERVER_NOT_FOUND_TEXT = "해당 번호로 통관/배송 정보를 찾을 수 없습니다";
const CAUSE_OF: Readonly<Partial<Record<FailureFixture, FailureCause>>> = { notFound404: "notFound", serverError500: "serverError" };
const SETTLE_TIMEOUT_MS = 15_000;

type Answer = TrackResponseData | FailureFixture;
interface SeenRequest {
  readonly number: string;
  readonly carrier: string;
}

function field(body: unknown, name: "trackingNumber" | "carrierCode"): string {
  if (typeof body !== "object" || body === null || !(name in body)) return "";
  const value: unknown = Reflect.get(body, name);
  return typeof value === "string" ? value : "";
}

/** Answers POST /api/track per requested number (optionally late) and records every request. */
async function answerByNumber(
  page: Page,
  answers: Readonly<Record<string, Answer>>,
  delays: Readonly<Record<string, number>> = {}
): Promise<SeenRequest[]> {
  const seen: SeenRequest[] = [];
  await page.route("**/api/track", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.fallback();
      return;
    }
    const body: unknown = request.postDataJSON();
    const number = field(body, "trackingNumber");
    seen.push({ number, carrier: field(body, "carrierCode") });
    const delayMs = delays[number] ?? 0;
    if (delayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    const answer: Answer = answers[number] ?? "notFound404";
    const reply = typeof answer === "string" ? FAILURE_RESPONSES[answer] : { status: 200, contentType: "application/json", body: successBody(answer) };
    try {
      await route.fulfill(reply);
    } catch (error) {
      // An aborted run's request no longer exists when its late answer arrives.
      if (!(error instanceof Error) || !/closed|disposed|already handled/i.test(error.message)) throw error;
    }
  });
  return seen;
}

function outcomeOf(number: string, answer: Answer): LookupOutcome {
  const request = { number, carrier: "AUTO", entry: "manual" } as const;
  if (typeof answer !== "string") return { kind: "success", request, data: answer };
  const cause = CAUSE_OF[answer];
  if (cause === undefined) throw new Error(`no cause mapped for ${answer}`);
  return { kind: "failure", request, cause, consecutiveFailures: 1 };
}

/** The view and replies the desk must show: the customer page's view (deriveResultView) and buildCsReply over it. */
function expected(outcome: LookupOutcome): { readonly view: TrackingViewModel; readonly reply: CsReply } {
  const view = deriveResultView(outcome, FIXTURE_NOW);
  return { view, reply: buildCsReply(view, { now: FIXTURE_NOW, notices: siteConfig.notices }) };
}

const bulkRow = (page: Page, number: string): Locator => page.locator(`[data-bulk-row="${number}"]`);
const doneRows = (page: Page): Locator => page.locator('[data-bulk-row][data-bulk-status="done"]');

async function runDesk(page: Page, lines: readonly string[], carrierName?: string): Promise<void> {
  await openDesk(page, "delivery");
  await page.getByLabel(INPUT_LABEL, { exact: true }).fill(lines.join("\n"));
  if (carrierName !== undefined) await page.getByRole("radio", { name: carrierName, exact: true }).check();
  await page.getByRole("button", { name: "조회 시작", exact: true }).click();
}

async function openRow(page: Page, number: string): Promise<Locator> {
  await expect(bulkRow(page, number)).toHaveAttribute("data-bulk-status", "done", { timeout: SETTLE_TIMEOUT_MS });
  await bulkRow(page, number).getByRole("button", { name: "화면 보기", exact: true }).click();
  const detail = page.locator(`[data-bulk-detail="${number}"]`);
  await expect(detail).toBeVisible();
  return detail;
}

test("one number: the row shows the number and carrier, and the replies equal buildCsReply over the customer's view", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const data = deliveredData();
  await answerByNumber(page, { [FAKE.domestic]: data });
  await runDesk(page, [FAKE_GROUPED.domestic]);
  const { view, reply } = expected(outcomeOf(FAKE.domestic, data));
  const row = bulkRow(page, FAKE.domestic);
  await expect(row).toHaveAttribute("data-bulk-status", "done", { timeout: SETTLE_TIMEOUT_MS });
  await expect(row).toHaveAttribute("data-tone", view.tone);
  await expect(row.getByRole("rowheader")).toContainText(FAKE.domestic);
  await expect(row.getByRole("rowheader")).toContainText("CJ대한통운");
  await expect(row.locator("[data-status-chip]")).toHaveText(TONE_LABELS[view.tone]);
  await expect(row).toContainText(view.title);
  const detail = await openRow(page, FAKE.domestic);
  await expect(detail.getByLabel("짧은 답변", { exact: true })).toHaveValue(reply.short);
  await expect(detail.getByLabel("자세한 답변", { exact: true })).toHaveValue(reply.long);
  expect(reply.long).toContain(reply.customerLink);
  expect(`${reply.short}\n${reply.long}`).not.toMatch(/택배사 자동 확인|관리자에게/);
});

test("the copy buttons copy the short reply, the long reply and the customer link", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await recordClipboard(page);
  const data = deliveredData();
  await answerByNumber(page, { [FAKE.domestic]: data });
  await runDesk(page, [FAKE.domestic]);
  const { reply } = expected(outcomeOf(FAKE.domestic, data));
  const row = bulkRow(page, FAKE.domestic);
  await expect(row).toHaveAttribute("data-bulk-status", "done", { timeout: SETTLE_TIMEOUT_MS });
  for (const name of ["짧게 복사", "자세히 복사", "고객 링크 복사"]) {
    await row.getByRole("button", { name, exact: true }).click();
  }
  await expect.poll(() => copiedTexts(page)).toEqual([reply.short, reply.long, reply.customerLink]);
  await expect(row.getByRole("button", { name: "복사했어요", exact: true })).toHaveCount(3);
});

test("pending: the reply comes from the same view, and a run stores nothing in the browser", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const data = pendingData();
  await answerByNumber(page, { [FAKE.domestic]: data });
  await runDesk(page, [FAKE.domestic]);
  const { reply } = expected(outcomeOf(FAKE.domestic, data));
  const detail = await openRow(page, FAKE.domestic);
  await expect(detail.getByLabel("자세한 답변", { exact: true })).toHaveValue(reply.long);
  const stored = await page.evaluate(() => {
    const dump = (storage: Storage): string[] =>
      Array.from({ length: storage.length }, (_, index) => {
        const key = storage.key(index) ?? "";
        return `${key}=${storage.getItem(key) ?? ""}`;
      });
    return [...dump(window.localStorage), ...dump(window.sessionStorage)].join("\n");
  });
  expect(stored).not.toContain(FAKE.domestic);
  expect(stored).not.toContain(FAKE_GROUPED.domestic);
  expect(await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_LEGACY_KEY)).toBeNull();
});

test("a failed lookup gets the CS error reply, never the server message", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await answerByNumber(page, { [FAKE.domestic]: "notFound404" });
  await runDesk(page, [FAKE.domestic]);
  const { view, reply } = expected(outcomeOf(FAKE.domestic, "notFound404"));
  const detail = await openRow(page, FAKE.domestic);
  await expect(bulkRow(page, FAKE.domestic)).toHaveAttribute("data-tone", view.tone);
  await expect(detail.getByLabel("자세한 답변", { exact: true })).toHaveValue(reply.long);
  await expect(detail.locator("[data-result-view]")).toHaveAttribute("data-result-view", "error");
  await expect(page.getByText(SERVER_NOT_FOUND_TEXT)).toHaveCount(0);
});

test("문제 and 확인 필요 rows come first; the others keep the pasted order", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const answers: Readonly<Record<string, Answer>> = {
    [FAKE.domestic]: deliveredData(),
    [FAKE.hbl]: customsWaitingData(),
    [FAKE.domesticAlt]: "serverError500",
    [FAKE.hblAlt]: "notFound404"
  };
  const numbers = [FAKE.domestic, FAKE.hbl, FAKE.domesticAlt, FAKE.hblAlt];
  await answerByNumber(page, answers);
  await runDesk(page, numbers);
  await expect(doneRows(page)).toHaveCount(numbers.length, { timeout: SETTLE_TIMEOUT_MS });
  const rows: readonly BulkRow[] = numbers.map((number) => {
    const outcome = outcomeOf(number, answers[number]);
    return { number, status: "done", outcome, view: expected(outcome).view };
  });
  const order = await page.locator("[data-bulk-row]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-bulk-row")));
  expect(order).toEqual(sortBulkRows(rows).map((row) => row.number));
  await expect(page.locator("[data-bulk-row]").first()).toHaveAttribute("data-tone", "problem");
});

test("the open row shows the customer's screen at 375 px, read-only", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(FIXTURE_NOW);
  const data = customsWaitingData();
  await answerByNumber(page, { [FAKE.hbl]: data });
  await runDesk(page, [FAKE.hbl]);
  const { view } = expected(outcomeOf(FAKE.hbl, data));
  const detail = await openRow(page, FAKE.hbl);
  const frame = detail.locator('[data-preview-frame="375"]');
  expect((await frame.boundingBox())?.width).toBe(375);
  const result = frame.locator("[data-result-view]");
  await expect(result).toHaveAttribute("data-read-only", "true");
  await expect(result).toHaveAttribute("data-frame", "mobile");
  await expect(frame.locator("[data-number-bar]")).toContainText(FAKE.hbl);
  const heading = frame.getByRole("heading", { level: 2 }).first();
  await expect(heading).toHaveText(view.title);
  await expect(heading).not.toBeFocused();
  const url = page.url();
  const popup = page.context().waitForEvent("page", { timeout: 1000 }).then(
    () => true,
    () => false
  );
  await frame.locator("a[href]").first().click();
  expect(await popup).toBe(false);
  expect(page.url()).toBe(url);
});

test("pasted inquiry copies, chat lines and bad lines", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await answerByNumber(page, { [FAKE.hbl]: customsWaitingData(), [FAKE.domestic]: deliveredData() });
  const copy = buildInquiryCopy({ kind: "status", number: { raw: FAKE.hbl, grouped: FAKE_GROUPED.hbl }, stage: "통관 대기", lastEventAt: null });
  await runDesk(page, ["안녕하세요", copy, FAKE.invalidShort, FAKE.phone, FAKE_GROUPED.domestic]);
  await expect(page.locator("[data-bulk-row]")).toHaveCount(2);
  await expect(doneRows(page)).toHaveCount(2, { timeout: SETTLE_TIMEOUT_MS });
  await expect(page.locator("[data-bulk-rejected]")).toHaveText(`번호로 읽지 못한 줄 2개: ${FAKE.invalidShort} · ${maskPhone(FAKE.phone)}`);
  // Only the staff's own paste box still holds the full number.
  for (const shown of ["[data-bulk-rejected]", "[data-bulk-table]"]) await expect(page.locator(shown)).not.toContainText(FAKE.phone);
});

test("at most 20 numbers run, and [멈추기] stops the rest", async ({ page }) => {
  const numbers = Array.from({ length: BULK_MAX + 2 }, (_, index) => `0000${String(index + 1).padStart(8, "0")}`);
  const seen = await answerByNumber(page, Object.fromEntries(numbers.map((number) => [number, deliveredData()])));
  await runDesk(page, numbers);
  await expect(page.getByText(`최대 ${BULK_MAX}건까지만 조회해요. 나머지 번호는 빠졌어요.`)).toBeVisible();
  await expect(page.locator("[data-bulk-row]")).toHaveCount(BULK_MAX);
  await expect(doneRows(page)).toHaveCount(1, { timeout: SETTLE_TIMEOUT_MS });
  await page.getByRole("button", { name: "멈추기", exact: true }).click();
  await expect(page.getByRole("button", { name: "멈추기", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "조회 시작", exact: true })).not.toHaveAttribute("aria-busy", "true");
  const requestsAtStop = seen.length;
  await page.waitForTimeout(2 * BULK_MIN_INTERVAL_MS);
  expect(seen.length).toBe(requestsAtStop);
  expect(requestsAtStop).toBeLessThanOrEqual(2);
  const done = await doneRows(page).count();
  await expect(page.locator('[data-bulk-row][data-bulk-status="queued"]')).toHaveCount(BULK_MAX - done);
});

test("requests start at least 1000 ms apart and carry the chosen carrier", async ({ page }) => {
  await recordTrackStarts(page);
  const numbers = [FAKE.domestic, FAKE.hbl, FAKE.domesticAlt];
  const seen = await answerByNumber(page, Object.fromEntries(numbers.map((number) => [number, deliveredData()])));
  await runDesk(page, numbers, "한진택배");
  await expect(doneRows(page)).toHaveCount(numbers.length, { timeout: SETTLE_TIMEOUT_MS });
  expect(seen.map((request) => request.carrier)).toEqual(["HANJIN", "HANJIN", "HANJIN"]);
  const starts = await trackStarts(page);
  const gaps = starts.slice(1).map((start, index) => start - starts[index]);
  const minGap = Math.min(...gaps);
  console.log(`[budget] bulk spacing min: ${Math.round(minGap)} ms (min ${BULK_MIN_INTERVAL_MS} ms)`);
  expect(gaps).toHaveLength(numbers.length - 1);
  // 2 ms of slack: the run spaces starts with Date (whole milliseconds), the recorder reads performance.now().
  expect(minGap).toBeGreaterThanOrEqual(BULK_MIN_INTERVAL_MS - 2);
});

test("pressing [조회 시작] again keeps requests 1000 ms apart across runs", async ({ page }) => {
  await recordTrackStarts(page);
  await answerByNumber(page, { [FAKE.domestic]: deliveredData(), [FAKE.hbl]: deliveredData() });
  await runDesk(page, [FAKE.domestic]);
  await expect(bulkRow(page, FAKE.domestic)).toHaveAttribute("data-bulk-status", "done", { timeout: SETTLE_TIMEOUT_MS });
  await page.getByLabel(INPUT_LABEL, { exact: true }).fill(FAKE.hbl);
  await page.getByRole("button", { name: "조회 시작", exact: true }).click();
  await expect(bulkRow(page, FAKE.hbl)).toHaveAttribute("data-bulk-status", "done", { timeout: SETTLE_TIMEOUT_MS });
  const starts = await trackStarts(page);
  expect(starts).toHaveLength(2);
  // 2 ms of slack, as in the spacing test above.
  expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(BULK_MIN_INTERVAL_MS - 2);
});

test("a new run replaces the previous one; the old run's late answer is ignored", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await answerByNumber(page, { [FAKE.domestic]: deliveredData(), [FAKE.hbl]: customsWaitingData() }, { [FAKE.domestic]: 2000 });
  await runDesk(page, [FAKE.domestic]);
  await expect(bulkRow(page, FAKE.domestic)).toHaveAttribute("data-bulk-status", "running");
  await page.getByLabel(INPUT_LABEL, { exact: true }).fill(FAKE.hbl);
  await page.getByRole("button", { name: "조회 시작", exact: true }).click();
  await expect(bulkRow(page, FAKE.hbl)).toHaveAttribute("data-bulk-status", "done", { timeout: SETTLE_TIMEOUT_MS });
  await page.waitForTimeout(2500);
  await expect(page.locator("[data-bulk-row]")).toHaveCount(1);
  await expect(bulkRow(page, FAKE.domestic)).toHaveCount(0);
});

test("blocked clipboard: [짧게 복사] leaves the reply in a selected box", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await blockClipboard(page);
  const data = deliveredData();
  await answerByNumber(page, { [FAKE.domestic]: data });
  await runDesk(page, [FAKE.domestic]);
  const { reply } = expected(outcomeOf(FAKE.domestic, data));
  const row = bulkRow(page, FAKE.domestic);
  await expect(row).toHaveAttribute("data-bulk-status", "done", { timeout: SETTLE_TIMEOUT_MS });
  await row.getByRole("button", { name: "짧게 복사", exact: true }).click();
  const box = row.locator("textarea[data-copy-fallback]");
  await expect(box).toHaveValue(reply.short);
  await expect(box).toBeFocused();
});
