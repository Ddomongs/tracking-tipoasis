import { expect, test } from "@playwright/test";
import {
  MISMATCH_LEGACY_KEY,
  MISMATCH_TTL_DAYS,
  parseMismatchPayload,
  serializeMismatchPayload,
  type MismatchRecord
} from "@/lib/cs/mismatch-storage";
import { CUSTOMS_MISMATCH_TEMPLATES, type CustomsMismatchTemplateKey } from "@/lib/cs/mismatch-templates";
import { FAKE, FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const DAY_MS = 86_400_000;
const NOW = FIXTURE_NOW.getTime();
const isoDaysAgo = (days: number, extraMs = 0): string => new Date(NOW - days * DAY_MS - extraMs).toISOString();
const record = (id: string, createdAt: string, templateKey: CustomsMismatchTemplateKey = "default"): MismatchRecord => ({
  id,
  phone: FAKE.phone,
  content: "통관부호 확인 부탁드립니다.",
  trackingMemo: "ORDER-1",
  templateKey,
  createdAt
});

test("keeps the existing storage key and a 14-day lifetime", () => {
  expect(MISMATCH_LEGACY_KEY).toBe("tracking-tipoasis:customs-mismatch-records");
  expect(MISMATCH_TTL_DAYS).toBe(14);
});

test("nothing stored means an empty list and nothing to rewrite", () => {
  expect(parseMismatchPayload(null, NOW)).toEqual({ records: [], needsRewrite: false });
});

test("a v1 payload round-trips without a rewrite", () => {
  const records = [record("a", isoDaysAgo(1)), { ...record("b", isoDaysAgo(2), "hold"), updatedAt: isoDaysAgo(1) }];
  const raw = serializeMismatchPayload(records);
  expect(JSON.parse(raw)).toEqual({ v: 1, records });
  expect(parseMismatchPayload(raw, NOW)).toEqual({ records, needsRewrite: false });
});

test("the pre-S01 bare array is migrated to the v1 envelope", () => {
  const legacy = [record("a", isoDaysAgo(3))];
  expect(parseMismatchPayload(JSON.stringify(legacy), NOW)).toEqual({ records: legacy, needsRewrite: true });
});

test("drops broken records but keeps valid ones", () => {
  const valid = record("ok", isoDaysAgo(1));
  const raw = JSON.stringify([
    valid,
    { ...valid, id: 7 },
    { id: "no-template", phone: FAKE.phone, content: "x", trackingMemo: "", createdAt: isoDaysAgo(1) },
    { ...valid, id: "bad-template", templateKey: "other" },
    { ...valid, id: "bad-date", createdAt: "어제" },
    "not a record",
    null
  ]);
  expect(parseMismatchPayload(raw, NOW)).toEqual({ records: [valid], needsRewrite: true });
});

test("records older than 14 days are dropped at the boundary", () => {
  const edge = record("edge", isoDaysAgo(MISMATCH_TTL_DAYS));
  const expired = record("expired", isoDaysAgo(MISMATCH_TTL_DAYS, 1));
  const parsed = parseMismatchPayload(serializeMismatchPayload([edge, expired]), NOW);
  expect(parsed.records.map((item) => item.id)).toEqual(["edge"]);
  expect(parsed.needsRewrite).toBe(true);
});

test("a record dated more than a day in the future is dropped, so a wrong clock cannot keep it forever", () => {
  const skewed = record("skewed", new Date(NOW + 60 * 60 * 1000).toISOString());
  const future = record("future", new Date(NOW + 2 * DAY_MS).toISOString());
  const parsed = parseMismatchPayload(serializeMismatchPayload([skewed, future]), NOW);
  expect(parsed.records.map((item) => item.id)).toEqual(["skewed"]);
  expect(parsed.needsRewrite).toBe(true);
});

test("garbage, foreign versions and non-objects give an empty list", () => {
  for (const raw of ["not json", '{"v":2,"records":[]}', "null", "42", '{"records":[]}']) {
    expect(parseMismatchPayload(raw, NOW), raw).toEqual({ records: [], needsRewrite: true });
  }
});

test("every template key survives a round trip", () => {
  const keys = Object.keys(CUSTOMS_MISMATCH_TEMPLATES) as CustomsMismatchTemplateKey[];
  const records = keys.map((key, index) => record(`k${index}`, isoDaysAgo(1), key));
  expect(parseMismatchPayload(serializeMismatchPayload(records), NOW).records).toEqual(records);
});
