import { expect, test } from "@playwright/test";
import { siteConfig } from "@/config/site.config";
import {
  BULK_MAX,
  BULK_MIN_INTERVAL_MS,
  TONE_LABELS,
  initialBulkRows,
  parseBulkInput,
  sortBulkRows,
  runBulkLookup,
  summarizeBulkView,
  type BulkFetcher,
  type BulkRow
} from "@/lib/cs/bulk-lookup";
import type { FetchTrackResult } from "@/lib/tracking/fetch-track";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { buildInquiryCopy } from "@/lib/tracking/inquiry-copy";
import { formatKstDateTight } from "@/lib/tracking/time";
import type { EtaDate, LookupOutcome, LookupRequest, Tone, TrackingViewModel } from "@/lib/tracking/types";
import { customsWaitingData, deliveredData, pendingData, success } from "../fixtures/derive-scenarios";
import { FAKE, FAKE_GROUPED, FIXTURE_NOW } from "../fixtures/tracking-fixtures";

/** Twelve-digit fake numbers built at runtime from the 0000 prefix (never a literal run in the source). */
const fakeNumber = (serial: number): string => `0000${String(serial).padStart(8, "0")}`;
const hyphenated = (value: string): string => `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8)}`;

const BASE_VIEW: TrackingViewModel = deriveTrackingView(success(customsWaitingData()), FIXTURE_NOW, siteConfig);
const DATE: EtaDate = { key: "2026-09-30", label: "9월 30일 (수)", month: 9, day: 30, weekday: "수" };

function doneRow(number: string, tone: Tone): BulkRow {
  return { number, status: "done", outcome: success(deliveredData()), view: { ...BASE_VIEW, tone } };
}

test("the run limits are 20 numbers and 1000 ms between request starts", () => {
  expect(BULK_MAX).toBe(20);
  expect(BULK_MIN_INTERVAL_MS).toBe(1000);
});

test.describe("parseBulkInput", () => {
  test("one number per line; spaces, hyphens and lowercase are normalized", () => {
    const text = `${FAKE_GROUPED.domestic}\n${FAKE.hbl.toLowerCase()}\n  ${hyphenated(FAKE.domesticAlt)}  `;
    expect(parseBulkInput(text)).toEqual({ numbers: [FAKE.domestic, FAKE.hbl, FAKE.domesticAlt], rejected: [], truncated: false });
  });

  test("commas, semicolons and tabs separate numbers too", () => {
    const text = `${FAKE.domestic}, ${FAKE.hbl};${FAKE.domesticAlt}\t${FAKE.hblAlt}`;
    expect(parseBulkInput(text).numbers).toEqual([FAKE.domestic, FAKE.hbl, FAKE.domesticAlt, FAKE.hblAlt]);
  });

  test("a pasted chat keeps only the numbers: the inquiry copy is read, digit-free lines are skipped", () => {
    const copy = buildInquiryCopy({
      kind: "status",
      number: { raw: FAKE.domestic, grouped: FAKE_GROUPED.domestic },
      stage: "통관 대기",
      lastEventAt: FIXTURE_NOW
    });
    const text = ["안녕하세요", copy, "확인 부탁드려요", "조회번호", FAKE_GROUPED.hblAlt].join("\n");
    expect(parseBulkInput(text)).toEqual({ numbers: [FAKE.domestic, FAKE.hblAlt], rejected: [], truncated: false });
  });

  test("phone-shaped lines are rejected, never looked up", () => {
    const digitsOnly = FAKE.phone.replace(/-/g, "");
    const international = `+82 ${FAKE.phone.slice(1)}`;
    const text = [FAKE.phone, digitsOnly, international, FAKE.domestic].join("\n");
    expect(parseBulkInput(text)).toEqual({ numbers: [FAKE.domestic], rejected: [FAKE.phone, digitsOnly, international], truncated: false });
  });

  test("lines with digits that are not numbers come back to staff as written", () => {
    const text = [FAKE.invalidShort, "주문 A-12", FAKE.domestic].join("\n");
    expect(parseBulkInput(text)).toEqual({ numbers: [FAKE.domestic], rejected: [FAKE.invalidShort, "주문 A-12"], truncated: false });
  });

  test("the same number twice keeps the first; more than 20 numbers are cut at 20", () => {
    const many = Array.from({ length: BULK_MAX + 2 }, (_, index) => fakeNumber(index + 1));
    const parsed = parseBulkInput([many[0], hyphenated(many[0]), ...many].join("\n"));
    expect(parsed.numbers).toEqual(many.slice(0, BULK_MAX));
    expect(parsed.truncated).toBe(true);
    expect(parsed.rejected).toEqual([]);
  });

  test("an empty paste gives nothing", () => {
    expect(parseBulkInput(" \n\t\n")).toEqual({ numbers: [], rejected: [], truncated: false });
  });
});

test.describe("rows", () => {
  test("initialBulkRows queues every number without a view", () => {
    expect(initialBulkRows([FAKE.domestic, FAKE.hbl])).toEqual([
      { number: FAKE.domestic, status: "queued", outcome: null, view: null },
      { number: FAKE.hbl, status: "queued", outcome: null, view: null }
    ]);
  });

  test("sortBulkRows puts 문제, then 확인 필요 first and keeps the pasted order otherwise", () => {
    const rows: readonly BulkRow[] = [
      doneRow(fakeNumber(1), "progress"),
      doneRow(fakeNumber(2), "attention"),
      { number: fakeNumber(3), status: "running", outcome: null, view: null },
      doneRow(fakeNumber(4), "problem"),
      doneRow(fakeNumber(5), "done"),
      doneRow(fakeNumber(6), "attention")
    ];
    expect(sortBulkRows(rows).map((row) => row.number)).toEqual([4, 2, 6, 1, 5, 3].map(fakeNumber));
    expect(rows.map((row) => row.number)).toEqual([1, 2, 3, 4, 5, 6].map(fakeNumber));
  });
});

test.describe("summarizeBulkView", () => {
  test("tone label, title, worry date and last event come from the view", () => {
    const summary = summarizeBulkView(BASE_VIEW);
    const worryKey = BASE_VIEW.nextAction.worry?.dateKey ?? null;
    expect(worryKey).not.toBeNull();
    expect(summary.toneLabel).toBe(TONE_LABELS[BASE_VIEW.tone]);
    expect(summary.title).toBe(BASE_VIEW.title);
    expect(summary.worryDate).toBe(worryKey === null ? null : formatKstDateTight(worryKey));
    expect(summary.lastEvent).toBe(BASE_VIEW.lastEvent?.text ?? null);
  });

  test("the tone labels are the spec's tone names", () => {
    expect(TONE_LABELS).toEqual({
      neutral: "확인 중",
      progress: "정상 진행",
      waiting: "정보 대기",
      attention: "확인 필요",
      problem: "문제",
      done: "완료"
    });
  });

  test("a view without a worry date or a last event shows neither", () => {
    const summary = summarizeBulkView(deriveTrackingView(success(pendingData()), FIXTURE_NOW, siteConfig));
    expect(summary.worryDate).toBeNull();
    expect(summary.lastEvent).toBeNull();
  });

  test("every ETA kind reads as one cell and an optional note", () => {
    const cell = (eta: TrackingViewModel["eta"]) => {
      const { eta: text, etaNote } = summarizeBulkView({ ...BASE_VIEW, eta });
      return { text, etaNote };
    };
    expect(cell({ kind: "none" })).toEqual({ text: null, etaNote: null });
    expect(cell({ kind: "date", label: "도착 예상", date: DATE, dday: 4, caption: null })).toEqual({ text: "9월 30일 (수) · D-4", etaNote: null });
    expect(cell({ kind: "date", label: "도착 예상", date: DATE, dday: 4, caption: "통관 완료 9월 28일 (월)" }).etaNote).toBe("통관 완료 9월 28일 (월)");
    expect(cell({ kind: "today", label: "오늘 예상", date: DATE, caption: null })).toEqual({ text: "오늘 예상 · 9월 30일 (수)", etaNote: null });
    expect(
      cell({
        kind: "holidayAffected",
        label: "도착 예상",
        date: DATE,
        badge: "추석 연휴 영향 · 1~2일 늦어질 수 있어요",
        caption: null,
        holidayName: "추석 연휴"
      })
    ).toEqual({ text: "9월 30일 (수)", etaNote: "추석 연휴 영향 · 1~2일 늦어질 수 있어요" });
    expect(cell({ kind: "overdue", label: "예상했던 날짜", date: DATE })).toEqual({ text: "예상했던 날짜 9월 30일 (수)", etaNote: null });
    expect(cell({ kind: "deliveredOn", label: "배송 완료일", date: DATE })).toEqual({ text: "배송 완료일 9월 30일 (수)", etaNote: null });
    expect(cell({ kind: "pendingInfo", label: "도착 예상", text: "정보 등록 후 안내" })).toEqual({ text: "정보 등록 후 안내", etaNote: null });
    expect(cell({ kind: "withheld", label: "도착 예상", text: "지금은 도착 예상일을 안내하기 어려워요" }).text).toBe(
      "지금은 도착 예상일을 안내하기 어려워요"
    );
    expect(cell({ kind: "unknown", label: "도착 예상", text: "아직 예상일을 계산할 기록이 없어요" }).text).toBe("아직 예상일을 계산할 기록이 없어요");
  });
});

test.describe("runBulkLookup", () => {
  const DELIVERED: FetchTrackResult = { kind: "success", data: deliveredData() };
  const WAITING: FetchTrackResult = { kind: "success", data: customsWaitingData() };
  const NOT_FOUND: FetchTrackResult = { kind: "failure", input: { kind: "http", status: 404, code: "NOT_FOUND", isJson: true } };
  const FALLBACK: FetchTrackResult = { kind: "failure", input: { kind: "timeout" } };

  interface Harness {
    readonly now: () => Date;
    readonly wait: (ms: number) => Promise<void>;
    readonly fetcher: BulkFetcher;
    readonly starts: readonly number[];
    readonly requests: readonly LookupRequest[];
    readonly waits: readonly number[];
  }

  /** A fake clock: every answer takes `latencyMs` and `wait` advances the clock, so spacing is exact and no real time passes. */
  function harness(answers: readonly FetchTrackResult[], latencyMs: number): Harness {
    let clock = FIXTURE_NOW.getTime();
    const starts: number[] = [];
    const requests: LookupRequest[] = [];
    const waits: number[] = [];
    return {
      now: () => new Date(clock),
      wait: async (ms) => {
        waits.push(ms);
        if (ms > 0) clock += ms;
      },
      fetcher: async (request) => {
        starts.push(clock);
        requests.push(request);
        clock += latencyMs;
        return answers[requests.length - 1] ?? FALLBACK;
      },
      starts,
      requests,
      waits
    };
  }

  function recorder(): { readonly events: string[]; readonly rows: Map<number, BulkRow>; readonly onRow: (index: number, row: BulkRow) => void } {
    const events: string[] = [];
    const rows = new Map<number, BulkRow>();
    return {
      events,
      rows,
      onRow: (index, row) => {
        events.push(`${index}:${row.status}`);
        rows.set(index, row);
      }
    };
  }

  test("looks numbers up one by one, 1000 ms apart, reporting running then done", async () => {
    const run = harness([DELIVERED, WAITING, NOT_FOUND], 300);
    const seen = recorder();
    await runBulkLookup([FAKE.domestic, FAKE.hbl, FAKE.domesticAlt], "AUTO", {
      signal: new AbortController().signal,
      now: run.now,
      wait: run.wait,
      fetcher: run.fetcher,
      onRow: seen.onRow
    });
    expect(seen.events).toEqual(["0:running", "0:done", "1:running", "1:done", "2:running", "2:done"]);
    expect(run.starts.map((start) => start - run.starts[0])).toEqual([0, BULK_MIN_INTERVAL_MS, 2 * BULK_MIN_INTERVAL_MS]);
    expect(run.waits).toEqual([BULK_MIN_INTERVAL_MS - 300, BULK_MIN_INTERVAL_MS - 300]);
    const second = seen.rows.get(1);
    if (second === undefined || second.outcome === null) throw new Error("row 1 did not settle");
    expect(second.outcome).toEqual({
      kind: "success",
      request: { number: FAKE.hbl, carrier: "AUTO", entry: "manual" },
      data: customsWaitingData()
    });
    expect(second.view).toEqual(deriveTrackingView(second.outcome, new Date(run.starts[1] + 300), siteConfig));
    expect(seen.rows.get(2)?.outcome).toEqual({
      kind: "failure",
      request: { number: FAKE.domesticAlt, carrier: "AUTO", entry: "manual" },
      cause: "notFound",
      consecutiveFailures: 1
    });
  });

  test("a slow answer is not followed by an extra wait", async () => {
    const run = harness([DELIVERED, DELIVERED, DELIVERED], 1500);
    await runBulkLookup([FAKE.domestic, FAKE.hbl, FAKE.domesticAlt], "AUTO", {
      signal: new AbortController().signal,
      now: run.now,
      wait: run.wait,
      fetcher: run.fetcher,
      onRow: () => undefined
    });
    expect(run.starts.map((start) => start - run.starts[0])).toEqual([0, 1500, 3000]);
    expect(run.waits.every((ms) => ms <= 0)).toBe(true);
  });

  test("every request carries the chosen carrier, and only the first 20 numbers run", async () => {
    const numbers = Array.from({ length: BULK_MAX + 1 }, (_, index) => fakeNumber(index + 1));
    const run = harness(numbers.map(() => DELIVERED), 0);
    await runBulkLookup(numbers, "CJ", {
      signal: new AbortController().signal,
      now: run.now,
      wait: run.wait,
      fetcher: run.fetcher,
      onRow: () => undefined
    });
    expect(run.requests.map((request) => request.number)).toEqual(numbers.slice(0, BULK_MAX));
    expect(run.requests.every((request) => request.carrier === "CJ" && request.entry === "manual")).toBe(true);
  });

  test("stopping mid-request puts that row back in the queue and looks nothing else up", async () => {
    const controller = new AbortController();
    const run = harness([DELIVERED], 100);
    const fetcher: BulkFetcher = async (request, options) => {
      if (request.number !== FAKE.hbl) return run.fetcher(request, options);
      controller.abort();
      return { kind: "aborted" };
    };
    const seen = recorder();
    await runBulkLookup([FAKE.domestic, FAKE.hbl, FAKE.domesticAlt], "AUTO", {
      signal: controller.signal,
      now: run.now,
      wait: run.wait,
      fetcher,
      onRow: seen.onRow
    });
    expect(seen.events).toEqual(["0:running", "0:done", "1:running", "1:queued"]);
    expect(seen.rows.get(1)).toEqual({ number: FAKE.hbl, status: "queued", outcome: null, view: null });
  });

  test("stopping during the wait looks nothing else up", async () => {
    const controller = new AbortController();
    const run = harness([DELIVERED, DELIVERED], 100);
    const seen = recorder();
    await runBulkLookup([FAKE.domestic, FAKE.hbl], "AUTO", {
      signal: controller.signal,
      now: run.now,
      wait: async () => {
        controller.abort();
      },
      fetcher: run.fetcher,
      onRow: seen.onRow
    });
    expect(seen.events).toEqual(["0:running", "0:done"]);
    expect(run.requests).toHaveLength(1);
  });

  test("failures become failure outcomes with one failure each", async () => {
    const run = harness(
      [
        { kind: "failure", input: { kind: "timeout" } },
        { kind: "failure", input: { kind: "network", online: false } }
      ],
      50
    );
    const seen = recorder();
    await runBulkLookup([FAKE.domestic, FAKE.hbl], "AUTO", {
      signal: new AbortController().signal,
      now: run.now,
      wait: run.wait,
      fetcher: run.fetcher,
      onRow: seen.onRow
    });
    expect(seen.rows.get(0)?.outcome).toMatchObject({ kind: "failure", cause: "clientTimeout", consecutiveFailures: 1 });
    expect(seen.rows.get(1)?.outcome).toMatchObject({ kind: "failure", cause: "offline", consecutiveFailures: 1 });
    expect(seen.rows.get(1)?.view?.mode).toBe("error");
  });

  test("a custom derive builds every settled row's view", async () => {
    const run = harness([DELIVERED, NOT_FOUND], 10);
    const derive = (outcome: LookupOutcome, now: Date): TrackingViewModel => ({
      ...deriveTrackingView(outcome, now, siteConfig),
      title: "시험용 제목"
    });
    const seen = recorder();
    await runBulkLookup([FAKE.domestic, FAKE.hbl], "AUTO", {
      signal: new AbortController().signal,
      now: run.now,
      wait: run.wait,
      fetcher: run.fetcher,
      derive,
      onRow: seen.onRow
    });
    expect([seen.rows.get(0)?.view?.title, seen.rows.get(1)?.view?.title]).toEqual(["시험용 제목", "시험용 제목"]);
  });

  test("the default wait keeps real requests at least 1000 ms apart", async () => {
    const starts: number[] = [];
    await runBulkLookup([FAKE.domestic, FAKE.hbl], "AUTO", {
      signal: new AbortController().signal,
      now: () => new Date(),
      fetcher: async () => {
        starts.push(Date.now());
        return DELIVERED;
      },
      onRow: () => undefined
    });
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(BULK_MIN_INTERVAL_MS - 5);
  });

  test("the default wait ends at once when stopped", async () => {
    const controller = new AbortController();
    const startedAt = Date.now();
    await runBulkLookup([FAKE.domestic, FAKE.hbl], "AUTO", {
      signal: controller.signal,
      now: () => new Date(),
      fetcher: async () => DELIVERED,
      onRow: (_, row) => {
        if (row.status === "done") controller.abort();
      }
    });
    expect(Date.now() - startedAt).toBeLessThan(500);
  });
});
