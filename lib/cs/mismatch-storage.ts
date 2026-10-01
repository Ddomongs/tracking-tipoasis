import { z } from "zod";
import type { CustomsMismatchTemplateKey } from "@/lib/cs/mismatch-templates";

// Internal-only (contract §11.1 rule 4). Customs-mismatch drafts hold customer phone numbers, so they stay in this
// browser only (spec §10 ②, approval 14): this tab by default (sessionStorage), this browser for 7 days only when staff
// turn the keep on (localStorage with an expiry). S01's 14-day localStorage list is migrated once and removed.

/** S01's key (localStorage, v1 or a bare array). Read once on subscribe, merged into MISMATCH_KEY, then removed. */
export const MISMATCH_LEGACY_KEY = "tracking-tipoasis:customs-mismatch-records";
/** Legacy records older than this are dropped while migrating (S01's lifetime). */
export const MISMATCH_TTL_DAYS = 14;
/** Roadmap §11.14: `{ "v": 2, "keepUntil": string | null, "records": MismatchRecord[] }`. */
export const MISMATCH_KEY = "tt:cs-mismatch";
export const MISMATCH_KEEP_DAYS = 7;

/** Progress of one mismatch notice (spec §10 상태: 작성·발송·회신·완료). Staff set it by hand; the tool never sends anything. */
export const MISMATCH_STATUSES = ["draft", "sent", "replied", "done"] as const;
export type MismatchStatus = (typeof MISMATCH_STATUSES)[number];
export const MISMATCH_STATUS_LABELS: Readonly<Record<MismatchStatus, string>> = {
  draft: "작성",
  sent: "발송",
  replied: "회신",
  done: "완료"
};

export interface MismatchRecord {
  readonly id: string;
  readonly phone: string;
  readonly content: string;
  readonly trackingMemo: string;
  readonly templateKey: CustomsMismatchTemplateKey;
  readonly status: MismatchStatus;
  readonly createdAt: string;
  readonly updatedAt?: string;
}

/** Where the list lives now: this tab only, or this browser until keepUntil. */
export type MismatchRetention = { readonly kind: "session" } | { readonly kind: "kept"; readonly keepUntil: string };

export interface ParsedMismatchPayload {
  readonly records: readonly MismatchRecord[];
  /** True when storage holds anything other than exactly serializeMismatchPayload(records): legacy array, broken or expired records, garbage. */
  readonly needsRewrite: boolean;
}

export interface ParsedStore {
  readonly records: readonly MismatchRecord[];
  readonly keepUntil: string | null;
  /** False for nothing stored, garbage, another version, or a keep that has expired. */
  readonly valid: boolean;
  /** True when storage holds anything other than exactly serializeStorePayload(records, keepUntil). */
  readonly needsRewrite: boolean;
}

const LEGACY_VERSION = 1;
const PAYLOAD_VERSION = 2;
const DAY_MS = 86_400_000;
const TTL_MS = MISMATCH_TTL_DAYS * DAY_MS;
const KEEP_MS = MISMATCH_KEEP_DAYS * DAY_MS;

const TEMPLATE_KEYS = ["default", "recipient", "hold"] as const satisfies readonly CustomsMismatchTemplateKey[];

const MismatchRecordSchema = z.object({
  id: z.string().min(1),
  phone: z.string(),
  content: z.string(),
  trackingMemo: z.string(),
  templateKey: z.enum(TEMPLATE_KEYS),
  // Records saved before statuses existed read as 작성 (the rewrite on subscribe then stores the field).
  status: z.enum(MISMATCH_STATUSES).default("draft"),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }).optional()
});

const LegacyPayloadSchema = z.object({ v: z.literal(LEGACY_VERSION), records: z.array(z.unknown()) });
const StorePayloadSchema = z.object({
  v: z.literal(PAYLOAD_VERSION),
  keepUntil: z.string().datetime({ offset: true }).nullable(),
  records: z.array(z.unknown())
});

const EMPTY_RECORDS: readonly MismatchRecord[] = [];
const SESSION_RETENTION: MismatchRetention = { kind: "session" };
const NOTHING_STORED: ParsedStore = { records: EMPTY_RECORDS, keepUntil: null, valid: false, needsRewrite: false };
const UNUSABLE_STORE: ParsedStore = { records: EMPTY_RECORDS, keepUntil: null, valid: false, needsRewrite: true };

export const createRecordId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizePhone = (value: string): string => value.replace(/[^\d-]/g, "").trim();

export function isMismatchStatus(value: unknown): value is MismatchStatus {
  return typeof value === "string" && MISMATCH_STATUSES.some((status) => status === value);
}

/** A copy of `records` with one record's status changed and `updatedAt` set; every other record is the same object. */
export function withRecordStatus(
  records: readonly MismatchRecord[],
  id: string,
  status: MismatchStatus,
  now: Date
): readonly MismatchRecord[] {
  return records.map((record) => (record.id === id ? { ...record, status, updatedAt: now.toISOString() } : record));
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null; // unreadable storage is treated as empty and rewritten
  }
}

function validRecords(candidates: readonly unknown[]): MismatchRecord[] {
  return candidates.flatMap((candidate) => {
    const parsed = MismatchRecordSchema.safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
}

// ---- S01's v1 payload: read only to migrate the legacy key ----

export function serializeMismatchPayload(records: readonly MismatchRecord[]): string {
  return JSON.stringify({ v: LEGACY_VERSION, records });
}

function legacyCandidates(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value; // pre-S01 format: a bare array
  const payload = LegacyPayloadSchema.safeParse(value);
  return payload.success ? payload.data.records : [];
}

/** Clock skew tolerated for createdAt and keepUntil; anything later came from a wrong clock or a hand edit and would never expire. */
const FUTURE_TOLERANCE_MS = DAY_MS;

const isFresh = (record: MismatchRecord, now: number): boolean => {
  const age = now - Date.parse(record.createdAt);
  return age <= TTL_MS && age >= -FUTURE_TOLERANCE_MS;
};

export function parseMismatchPayload(raw: string | null, now: number): ParsedMismatchPayload {
  if (raw === null) return { records: EMPTY_RECORDS, needsRewrite: false };
  const records = validRecords(legacyCandidates(parseJson(raw))).filter((record) => isFresh(record, now));
  return { records, needsRewrite: serializeMismatchPayload(records) !== raw };
}

// ---- v2 payload (approval 14) ----

export function serializeStorePayload(records: readonly MismatchRecord[], keepUntil: string | null): string {
  return JSON.stringify({ v: PAYLOAD_VERSION, keepUntil, records });
}

export function parseStorePayload(raw: string | null, now: number): ParsedStore {
  if (raw === null) return NOTHING_STORED;
  const payload = StorePayloadSchema.safeParse(parseJson(raw));
  if (!payload.success) return UNUSABLE_STORE;
  const { keepUntil } = payload.data;
  if (keepUntil !== null) {
    const until = Date.parse(keepUntil);
    if (now >= until || until - now > KEEP_MS + FUTURE_TOLERANCE_MS) return UNUSABLE_STORE;
  }
  const records = validRecords(payload.data.records);
  return { records, keepUntil, valid: true, needsRewrite: serializeStorePayload(records, keepUntil) !== raw };
}

// ---- Browser store for useSyncExternalStore ----

type Area = "session" | "local";

/** Throws when the browser refuses storage (private windows, policies). */
function storageOf(area: Area): Storage {
  return area === "session" ? window.sessionStorage : window.localStorage;
}

function readRaw(area: Area, key: string): string | null {
  try {
    return storageOf(area).getItem(key);
  } catch {
    return null; // refused storage behaves as "nothing stored"
  }
}

function removeQuietly(area: Area, key: string): void {
  try {
    storageOf(area).removeItem(key);
  } catch {
    // Refused storage holds nothing this page can read, so there is nothing to remove.
  }
}

interface StoreState {
  readonly area: Area;
  readonly parsed: ParsedStore;
}

/** A kept list (localStorage, before keepUntil) wins; otherwise this tab's list (sessionStorage). */
function readState(now: number): StoreState {
  const kept = parseStorePayload(readRaw("local", MISMATCH_KEY), now);
  if (kept.valid && kept.keepUntil !== null) return { area: "local", parsed: kept };
  return { area: "session", parsed: parseStorePayload(readRaw("session", MISMATCH_KEY), now) };
}

/** Throws when the browser refuses storage. A tab list never carries keepUntil. */
function writeState(area: Area, records: readonly MismatchRecord[], keepUntil: string | null): void {
  storageOf(area).setItem(MISMATCH_KEY, serializeStorePayload(records, area === "local" ? keepUntil : null));
}

const listeners = new Set<() => void>();
// getSnapshot must return stable references, so re-parse only when the stored text changes.
let snapshotKey: string | null = null;
let snapshotRecords: readonly MismatchRecord[] = EMPTY_RECORDS;
let snapshotRetention: MismatchRetention = SESSION_RETENTION;

function notify(): void {
  listeners.forEach((listener) => listener());
}

function refreshSnapshot(): void {
  // JSON never contains a raw line break, so "\n" separates the two stored texts unambiguously.
  const key = `${readRaw("session", MISMATCH_KEY) ?? ""}\n${readRaw("local", MISMATCH_KEY) ?? ""}`;
  if (key === snapshotKey) return;
  snapshotKey = key;
  const { area, parsed } = readState(Date.now());
  snapshotRecords = parsed.records;
  snapshotRetention = area === "local" && parsed.keepUntil !== null ? { kind: "kept", keepUntil: parsed.keepUntil } : SESSION_RETENTION;
}

export function getStoredRecordsSnapshot(): readonly MismatchRecord[] {
  refreshSnapshot();
  return snapshotRecords;
}

export function getServerStoredRecordsSnapshot(): readonly MismatchRecord[] {
  return EMPTY_RECORDS;
}

export function getRetentionSnapshot(): MismatchRetention {
  refreshSnapshot();
  return snapshotRetention;
}

export function getServerRetentionSnapshot(): MismatchRetention {
  return SESSION_RETENTION;
}

/** Merges S01's legacy list into the current list once, then removes expired or broken payloads. Runs on subscribe. */
function migrateAndPurge(): void {
  const now = Date.now();
  let changed = false;
  const legacyRaw = readRaw("local", MISMATCH_LEGACY_KEY);
  if (legacyRaw !== null) {
    const legacy = parseMismatchPayload(legacyRaw, now).records;
    const { area, parsed } = readState(now);
    const known = new Set(parsed.records.map((record) => record.id));
    const merged = [...parsed.records, ...legacy.filter((record) => !known.has(record.id))];
    try {
      if (merged.length > 0) writeState(area, merged, parsed.keepUntil);
      storageOf("local").removeItem(MISMATCH_LEGACY_KEY);
      changed = true;
    } catch {
      // Storage refused: the legacy key stays and is migrated on a later visit.
    }
  }
  for (const area of ["local", "session"] as const) {
    const raw = readRaw(area, MISMATCH_KEY);
    if (raw === null) continue;
    const parsed = parseStorePayload(raw, now);
    // A kept list stays while it lasts (even empty: keeping is the staff's choice); a tab list only while it has records.
    const keepable = parsed.valid && (area === "local" ? parsed.keepUntil !== null : parsed.records.length > 0);
    if (keepable && !parsed.needsRewrite) continue;
    try {
      if (keepable) writeState(area, parsed.records, parsed.keepUntil);
      else storageOf(area).removeItem(MISMATCH_KEY);
      changed = true;
    } catch {
      // Read-only storage: the snapshot already ignores what cannot be removed.
    }
  }
  if (changed) notify();
}

export function subscribeStoredRecords(onChange: () => void): () => void {
  listeners.add(onChange);
  migrateAndPurge();
  return () => {
    listeners.delete(onChange);
  };
}

/** Writes the list where it lives now (this tab, or this browser while kept). Throws when the browser refuses storage. */
export function writeStoredRecords(records: readonly MismatchRecord[]): void {
  const { area, parsed } = readState(Date.now());
  writeState(area, records, parsed.keepUntil);
  notify();
}

/** Turns the keep on (this browser until now + 7 days) or off (back to this tab only). Throws when storage is refused. */
export function setKeepInBrowser(keep: boolean, now: Date): void {
  const { parsed } = readState(now.getTime());
  if (keep) {
    writeState("local", parsed.records, new Date(now.getTime() + KEEP_MS).toISOString());
    removeQuietly("session", MISMATCH_KEY);
  } else {
    writeState("session", parsed.records, null);
    removeQuietly("local", MISMATCH_KEY);
  }
  notify();
}

export function clearAllStoredRecords(): void {
  removeQuietly("session", MISMATCH_KEY);
  removeQuietly("local", MISMATCH_KEY);
  removeQuietly("local", MISMATCH_LEGACY_KEY);
  notify();
}
