import { expect, test } from "@playwright/test";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import {
  LOOKUP_LOG_EVENT,
  createUnipassTally,
  elapsedBucket,
  formatLookupLog,
  logLookup,
  setLookupLogSink,
  type LookupLogRecord
} from "@/lib/services/lookup-log";
import { FAKE } from "../fixtures/tracking-fixtures";

const base: LookupLogRecord = {
  route: "/api/track",
  elapsedBucket: "1to3s",
  unipassOk: 12,
  unipassFail: 0,
  resultKind: "notFound",
  errorCode: "NOT_FOUND"
};

test("elapsed time falls into the six fixed buckets", () => {
  const cases: ReadonlyArray<readonly [number, string]> = [
    [0, "lt1s"],
    [999, "lt1s"],
    [1_000, "1to3s"],
    [2_999, "1to3s"],
    [3_000, "3to6s"],
    [5_999, "3to6s"],
    [6_000, "6to10s"],
    [9_999, "6to10s"],
    [10_000, "10to15s"],
    [14_999, "10to15s"],
    [15_000, "ge15s"],
    [Number.NaN, "ge15s"],
    [-5, "lt1s"]
  ];
  for (const [ms, bucket] of cases) expect(elapsedBucket(ms), String(ms)).toBe(bucket);
});

test("a log line is the event name plus exactly the six spec fields", () => {
  const line = formatLookupLog(base);
  expect(line.startsWith(`${LOOKUP_LOG_EVENT} `)).toBe(true);
  const parsed: unknown = JSON.parse(line.slice(LOOKUP_LOG_EVENT.length + 1));
  expect(parsed).toEqual(base);
  expect(Object.keys(parsed as Record<string, unknown>)).toEqual([
    "route",
    "elapsedBucket",
    "unipassOk",
    "unipassFail",
    "resultKind",
    "errorCode"
  ]);
});

test("extra fields and odd values never reach the line", () => {
  const leaky = { ...base, unipassOk: -1, unipassFail: 1.5, trackingNumber: FAKE.hbl, phone: FAKE.phone };
  const bogusKind = { ...base, resultKind: FAKE.hbl, errorCode: FAKE.domestic } as unknown as LookupLogRecord;
  for (const line of [formatLookupLog(leaky), formatLookupLog(bogusKind)]) {
    expect(line).not.toContain(FAKE.hbl);
    expect(line).not.toContain(FAKE.domestic);
    expect(line).not.toContain("0000-1234");
    expect(containsTrackingLikeValue(line)).toBe(false);
  }
  expect(formatLookupLog(leaky)).toContain('"unipassOk":0,"unipassFail":0');
  expect(formatLookupLog(bogusKind)).toContain('"resultKind":"error","errorCode":"SERVER_ERROR"');
  expect(formatLookupLog({ ...base, unipassOk: 5_000 })).toContain('"unipassOk":999');
});

test("logLookup writes through the sink and survives a failing sink", () => {
  const lines: string[] = [];
  try {
    setLookupLogSink((line) => {
      lines.push(line);
    });
    logLookup(base);
    expect(lines).toEqual([formatLookupLog(base)]);
    setLookupLogSink(() => {
      throw new Error("sink down");
    });
    expect(() => logLookup(base)).not.toThrow();
  } finally {
    setLookupLogSink(null);
  }
});

test("the UNI-PASS tally counts answered and failed calls", () => {
  const tally = createUnipassTally();
  tally.record("ok");
  tally.record("ok");
  tally.record("fail");
  expect(tally.snapshot()).toEqual({ ok: 2, fail: 1 });
});
