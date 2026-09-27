import { expect, test } from "@playwright/test";
import { classifyFailure, guideKeyForFailure } from "@/lib/tracking/classify-failure";
import { ERROR_GUIDE_KEYS, GUIDE_KEYS, OVERDUE_CAPABLE_KEYS, PROBLEM_GUIDE_KEYS } from "@/lib/tracking/types";
import type { FailureCause, FailureInput, GuideKey } from "@/lib/tracking/types";

test.describe("guide key lists", () => {
  test("there are 19 unique guide keys", () => {
    expect(GUIDE_KEYS).toHaveLength(19);
    expect(new Set(GUIDE_KEYS).size).toBe(19);
  });

  test("problem keys are the error keys plus the three data problems", () => {
    const all = new Set<GuideKey>(GUIDE_KEYS);
    expect(ERROR_GUIDE_KEYS.every((key) => all.has(key))).toBe(true);
    expect([...PROBLEM_GUIDE_KEYS]).toEqual([...ERROR_GUIDE_KEYS, "stale", "lookupUnavailable", "ambiguous"]);
  });

  test("overdue applies only to the six normal progress keys", () => {
    const problems = new Set<GuideKey>(PROBLEM_GUIDE_KEYS);
    expect(OVERDUE_CAPABLE_KEYS.filter((key) => problems.has(key))).toEqual([]);
    expect([...OVERDUE_CAPABLE_KEYS]).toEqual([
      "customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp", "inTransit"
    ]);
  });
});

interface Row {
  readonly name: string;
  readonly input: FailureInput;
  readonly cause: FailureCause;
  readonly key: GuideKey;
}

const ROWS: readonly Row[] = [
  { name: "client pre-check", input: { kind: "precheck", reason: "tooShort" }, cause: "invalidNumber", key: "invalidNumber" },
  { name: "HTTP 400 JSON INVALID_NUMBER", input: { kind: "http", status: 400, code: "INVALID_NUMBER", isJson: true }, cause: "invalidNumber", key: "invalidNumber" },
  { name: "HTTP 413 without JSON", input: { kind: "http", status: 413, code: null, isJson: false }, cause: "invalidNumber", key: "invalidNumber" },
  { name: "HTTP 415 JSON", input: { kind: "http", status: 415, code: "INVALID_NUMBER", isJson: true }, cause: "invalidNumber", key: "invalidNumber" },
  { name: "HTTP 404 JSON NOT_FOUND", input: { kind: "http", status: 404, code: "NOT_FOUND", isJson: true }, cause: "notFound", key: "notFound" },
  { name: "HTTP 404 HTML page", input: { kind: "http", status: 404, code: null, isJson: false }, cause: "badGateway", key: "temporaryDelay" },
  { name: "HTTP 429 JSON RATE_LIMITED", input: { kind: "http", status: 429, code: "RATE_LIMITED", isJson: true }, cause: "rateLimited", key: "temporaryDelay" },
  { name: "HTTP 429 without JSON", input: { kind: "http", status: 429, code: null, isJson: false }, cause: "rateLimited", key: "temporaryDelay" },
  { name: "HTTP 503 JSON API_TIMEOUT", input: { kind: "http", status: 503, code: "API_TIMEOUT", isJson: true }, cause: "upstreamTimeout", key: "temporaryDelay" },
  { name: "HTTP 504 JSON API_TIMEOUT", input: { kind: "http", status: 504, code: "API_TIMEOUT", isJson: true }, cause: "upstreamTimeout", key: "temporaryDelay" },
  { name: "HTTP 408 JSON", input: { kind: "http", status: 408, code: null, isJson: true }, cause: "upstreamTimeout", key: "temporaryDelay" },
  { name: "HTML 502", input: { kind: "http", status: 502, code: null, isJson: false }, cause: "badGateway", key: "temporaryDelay" },
  { name: "HTTP 500 JSON SERVER_ERROR", input: { kind: "http", status: 500, code: "SERVER_ERROR", isJson: true }, cause: "serverError", key: "serverError" },
  { name: "HTTP 404 JSON with another code", input: { kind: "http", status: 404, code: "SERVER_ERROR", isJson: true }, cause: "serverError", key: "serverError" },
  { name: "HTTP 200 body fails the response schema", input: { kind: "contract" }, cause: "contractViolation", key: "serverError" },
  { name: "fetch TypeError while online", input: { kind: "network", online: true }, cause: "network", key: "temporaryDelay" },
  { name: "fetch TypeError while offline", input: { kind: "network", online: false }, cause: "offline", key: "offline" },
  { name: "our AbortController timeout", input: { kind: "timeout" }, cause: "clientTimeout", key: "noResponse" }
];

for (const row of ROWS) {
  test(`${row.name} → ${row.cause} → ${row.key}`, () => {
    expect(classifyFailure(row.input)).toBe(row.cause);
    expect(guideKeyForFailure(row.cause)).toBe(row.key);
  });
}

test("every failure cause maps to an error guide key", () => {
  const errors = new Set<GuideKey>(ERROR_GUIDE_KEYS);
  const causes: readonly FailureCause[] = [
    "invalidNumber", "notFound", "rateLimited", "upstreamTimeout", "badGateway",
    "network", "offline", "clientTimeout", "serverError", "contractViolation"
  ];
  expect(causes.filter((cause) => !errors.has(guideKeyForFailure(cause)))).toEqual([]);
});
