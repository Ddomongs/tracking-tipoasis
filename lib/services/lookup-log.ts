import type { ApiError } from "@/lib/types";

/**
 * One number-free log line per POST /api/track request (spec §11 "2단계").
 * Only enums and small integers: never a tracking number, phone, IP, UA, URL or free text.
 */

/** "ok" = 2xx with the UNI-PASS envelope; "fail" = timeout, network error, non-2xx or unreadable body. */
export type UnipassCallOutcome = "ok" | "fail";

export const LOOKUP_RESULT_KINDS = [
  "found",
  "carrierFirst",
  "pending",
  "lookupUnavailable",
  "ambiguous",
  "notFound",
  "notFoundCached",
  "cached",
  "allFailed",
  "invalid",
  "rateLimited",
  "error"
] as const;
export type LookupResultKind = (typeof LOOKUP_RESULT_KINDS)[number];

const ELAPSED_BUCKETS = ["lt1s", "1to3s", "3to6s", "6to10s", "10to15s", "ge15s"] as const;
export type ElapsedBucket = (typeof ELAPSED_BUCKETS)[number];

const ERROR_CODES: readonly ApiError["code"][] = [
  "INVALID_NUMBER",
  "API_TIMEOUT",
  "NOT_FOUND",
  "SERVER_ERROR",
  "RATE_LIMITED"
];

export interface LookupLogRecord {
  readonly route: "/api/track";
  readonly elapsedBucket: ElapsedBucket;
  readonly unipassOk: number;
  readonly unipassFail: number;
  readonly resultKind: LookupResultKind;
  readonly errorCode: ApiError["code"] | null;
}

export const LOOKUP_LOG_EVENT = "track_lookup";

const MAX_COUNT = 999;
const BUCKET_UPPER_BOUNDS: ReadonlyArray<readonly [number, ElapsedBucket]> = [
  [1_000, "lt1s"],
  [3_000, "1to3s"],
  [6_000, "3to6s"],
  [10_000, "6to10s"],
  [15_000, "10to15s"]
];

export function elapsedBucket(ms: number): ElapsedBucket {
  if (Number.isNaN(ms)) return "ge15s";
  const safe = Math.max(0, ms);
  return BUCKET_UPPER_BOUNDS.find(([upper]) => safe < upper)?.[1] ?? "ge15s";
}

const pick = <T extends string>(allowed: readonly T[], value: string, fallback: T): T =>
  allowed.find((item) => item === value) ?? fallback;

const toCount = (value: number): number => (Number.isInteger(value) && value >= 0 ? Math.min(value, MAX_COUNT) : 0);

/** Copies only the six spec fields and re-checks every value, so a caller can never leak data into the line. */
export function formatLookupLog(record: LookupLogRecord): string {
  const line: LookupLogRecord = {
    route: "/api/track",
    elapsedBucket: pick(ELAPSED_BUCKETS, record.elapsedBucket, "ge15s"),
    unipassOk: toCount(record.unipassOk),
    unipassFail: toCount(record.unipassFail),
    resultKind: pick(LOOKUP_RESULT_KINDS, record.resultKind, "error"),
    errorCode: record.errorCode === null ? null : pick(ERROR_CODES, record.errorCode, "SERVER_ERROR")
  };
  return `${LOOKUP_LOG_EVENT} ${JSON.stringify(line)}`;
}

type LogSink = (line: string) => void;
const consoleSink: LogSink = (line) => {
  console.info(line);
};
let activeSink: LogSink = consoleSink;

/** Test seam: capture lines instead of printing them. `null` restores console.info. */
export function setLookupLogSink(sink: LogSink | null): void {
  activeSink = sink ?? consoleSink;
}

/** Writes one line per request. A failing sink never breaks the customer's answer. */
export function logLookup(record: LookupLogRecord): void {
  try {
    activeSink(formatLookupLog(record));
  } catch {
    // Logging is best effort by design: the lookup response must not depend on the log sink.
  }
}

export interface UnipassTally {
  readonly record: (outcome: UnipassCallOutcome) => void;
  readonly snapshot: () => { readonly ok: number; readonly fail: number };
}

export function createUnipassTally(): UnipassTally {
  const counts = { ok: 0, fail: 0 };
  return {
    record: (outcome) => {
      counts[outcome] += 1;
    },
    snapshot: () => ({ ok: counts.ok, fail: counts.fail })
  };
}
