import { expect, test } from "@playwright/test";
import {
  MISMATCH_KEEP_DAYS,
  MISMATCH_KEY,
  MISMATCH_LEGACY_KEY,
  MISMATCH_STATUSES,
  MISMATCH_STATUS_LABELS,
  MISMATCH_TTL_DAYS,
  isMismatchStatus,
  parseMismatchPayload,
  parseStorePayload,
  serializeMismatchPayload,
  serializeStorePayload,
  withRecordStatus,
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
  status: "draft",
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

test("the four statuses keep their order and Korean labels", () => {
  expect(MISMATCH_STATUSES).toEqual(["draft", "sent", "replied", "done"]);
  expect(MISMATCH_STATUS_LABELS).toEqual({ draft: "작성", sent: "발송", replied: "회신", done: "완료" });
  expect(isMismatchStatus("replied")).toBe(true);
  expect(isMismatchStatus("shipped")).toBe(false);
  expect(isMismatchStatus(undefined)).toBe(false);
});

test("records saved before statuses existed read as 작성 and are rewritten once", () => {
  const old = {
    id: "old",
    phone: FAKE.phone,
    content: "통관부호 확인 부탁드립니다.",
    trackingMemo: "ORDER-1",
    templateKey: "default",
    createdAt: isoDaysAgo(1)
  };
  const parsed = parseMismatchPayload(JSON.stringify({ v: 1, records: [old] }), NOW);
  expect(parsed.records).toEqual([{ ...old, status: "draft" }]);
  expect(parsed.needsRewrite).toBe(true);
  expect(parseMismatchPayload(serializeMismatchPayload(parsed.records), NOW).needsRewrite).toBe(false);
});

test("an unknown status drops the record", () => {
  const raw = JSON.stringify({ v: 1, records: [{ ...record("odd", isoDaysAgo(1)), status: "shipped" }, record("kept", isoDaysAgo(1))] });
  expect(parseMismatchPayload(raw, NOW).records.map((item) => item.id)).toEqual(["kept"]);
});

test("withRecordStatus changes one record, stamps updatedAt and leaves the others and the input untouched", () => {
  const first = record("a", isoDaysAgo(2));
  const second = record("b", isoDaysAgo(1));
  const input: readonly MismatchRecord[] = [first, second];
  const next = withRecordStatus(input, "b", "sent", FIXTURE_NOW);
  expect(next[0]).toBe(first);
  expect(next[1]).toEqual({ ...second, status: "sent", updatedAt: FIXTURE_NOW.toISOString() });
  expect(input[1].status).toBe("draft");
  expect(parseMismatchPayload(serializeMismatchPayload(next), NOW).needsRewrite).toBe(false);
});

test("approval 14: one key for the list and a 7-day keep", () => {
  expect(MISMATCH_KEY).toBe("tt:cs-mismatch");
  expect(MISMATCH_KEEP_DAYS).toBe(7);
});

test("a tab-only v2 payload round-trips without a rewrite", () => {
  const records = [record("a", isoDaysAgo(1))];
  const raw = serializeStorePayload(records, null);
  expect(JSON.parse(raw)).toEqual({ v: 2, keepUntil: null, records });
  expect(parseStorePayload(raw, NOW)).toEqual({ records, keepUntil: null, valid: true, needsRewrite: false });
});

test("a kept payload is valid until keepUntil and gone at keepUntil", () => {
  const keepUntil = new Date(NOW + DAY_MS).toISOString();
  const raw = serializeStorePayload([record("a", isoDaysAgo(1))], keepUntil);
  expect(parseStorePayload(raw, NOW + DAY_MS - 1)).toMatchObject({ keepUntil, valid: true, needsRewrite: false });
  expect(parseStorePayload(raw, NOW + DAY_MS)).toEqual({ records: [], keepUntil: null, valid: false, needsRewrite: true });
});

test("broken records are dropped from a v2 payload", () => {
  const valid = record("ok", isoDaysAgo(1));
  const raw = JSON.stringify({ v: 2, keepUntil: null, records: [valid, { ...valid, id: "bad-date", createdAt: "어제" }, null] });
  expect(parseStorePayload(raw, NOW)).toEqual({ records: [valid], keepUntil: null, valid: true, needsRewrite: true });
});

test("a v1 payload, garbage or nothing is not a v2 list", () => {
  expect(parseStorePayload(serializeMismatchPayload([record("a", isoDaysAgo(1))]), NOW)).toMatchObject({ valid: false, needsRewrite: true });
  expect(parseStorePayload("not json", NOW)).toMatchObject({ valid: false, needsRewrite: true });
  expect(parseStorePayload(null, NOW)).toEqual({ records: [], keepUntil: null, valid: false, needsRewrite: false });
});

test("a keepUntil further away than the 7-day keep is not trusted", () => {
  const tooFar = new Date(NOW + (MISMATCH_KEEP_DAYS + 2) * DAY_MS).toISOString();
  const raw = serializeStorePayload([record("a", isoDaysAgo(1))], tooFar);
  expect(parseStorePayload(raw, NOW)).toEqual({ records: [], keepUntil: null, valid: false, needsRewrite: true });
});
