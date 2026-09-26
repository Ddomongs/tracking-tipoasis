import { z } from "zod";
import type { CustomsMismatchTemplateKey } from "@/lib/services/cs-reply-template";

/** Existing key: drafts saved before S01 are migrated instead of lost (roadmap §11.14). */
export const MISMATCH_LEGACY_KEY = "tracking-tipoasis:customs-mismatch-records";
/** Customer phone numbers stay in this browser at most this long (spec §10; approval-14 fallback). */
export const MISMATCH_TTL_DAYS = 14;

const PAYLOAD_VERSION = 1;
const DAY_MS = 86_400_000;
const TTL_MS = MISMATCH_TTL_DAYS * DAY_MS;

export interface MismatchRecord {
  readonly id: string;
  readonly phone: string;
  readonly content: string;
  readonly trackingMemo: string;
  readonly templateKey: CustomsMismatchTemplateKey;
  readonly createdAt: string;
  readonly updatedAt?: string;
}

export interface ParsedMismatchPayload {
  readonly records: readonly MismatchRecord[];
  /** True when storage holds anything other than exactly serializeMismatchPayload(records): legacy array, broken or expired records, garbage. */
  readonly needsRewrite: boolean;
}

const TEMPLATE_KEYS = ["default", "recipient", "hold"] as const satisfies readonly CustomsMismatchTemplateKey[];

const MismatchRecordSchema = z.object({
  id: z.string().min(1),
  phone: z.string(),
  content: z.string(),
  trackingMemo: z.string(),
  templateKey: z.enum(TEMPLATE_KEYS),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }).optional()
});

const PayloadSchema = z.object({ v: z.literal(PAYLOAD_VERSION), records: z.array(z.unknown()) });

const EMPTY_RECORDS: readonly MismatchRecord[] = [];

export const createRecordId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizePhone = (value: string): string => value.replace(/[^\d-]/g, "").trim();

export function serializeMismatchPayload(records: readonly MismatchRecord[]): string {
  return JSON.stringify({ v: PAYLOAD_VERSION, records });
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null; // unreadable storage is treated as empty and rewritten
  }
}

function candidateRecords(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value; // pre-S01 format: a bare array
  const payload = PayloadSchema.safeParse(value);
  return payload.success ? payload.data.records : [];
}

const isFresh = (record: MismatchRecord, now: number): boolean => now - Date.parse(record.createdAt) <= TTL_MS;

export function parseMismatchPayload(raw: string | null, now: number): ParsedMismatchPayload {
  if (raw === null) return { records: EMPTY_RECORDS, needsRewrite: false };
  const records = candidateRecords(parseJson(raw)).flatMap((candidate) => {
    const parsed = MismatchRecordSchema.safeParse(candidate);
    return parsed.success && isFresh(parsed.data, now) ? [parsed.data] : [];
  });
  return { records, needsRewrite: serializeMismatchPayload(records) !== raw };
}

// ---- Browser store for useSyncExternalStore ----
const listeners = new Set<() => void>();
// getSnapshot must return a stable reference, so re-parse only when the stored text changes.
let snapshotRaw: string | null = null;
let snapshotRecords: readonly MismatchRecord[] = EMPTY_RECORDS;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(MISMATCH_LEGACY_KEY);
  } catch {
    return null; // storage refused (private window, policy): behave as "nothing stored"
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function getStoredRecordsSnapshot(): readonly MismatchRecord[] {
  const raw = readRaw();
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshotRecords = parseMismatchPayload(raw, Date.now()).records;
  }
  return snapshotRecords;
}

export function getServerStoredRecordsSnapshot(): readonly MismatchRecord[] {
  return EMPTY_RECORDS;
}

/** Rewrites storage when it holds a legacy array, broken or expired records. Runs on subscribe, never during render. */
function purgeStoredRecords(): void {
  const { records, needsRewrite } = parseMismatchPayload(readRaw(), Date.now());
  if (!needsRewrite) return;
  try {
    if (records.length === 0) window.localStorage.removeItem(MISMATCH_LEGACY_KEY);
    else window.localStorage.setItem(MISMATCH_LEGACY_KEY, serializeMismatchPayload(records));
  } catch {
    return; // storage became read-only: the snapshot already hides expired records; the next visit retries
  }
  notify();
}

export function subscribeStoredRecords(onChange: () => void): () => void {
  listeners.add(onChange);
  purgeStoredRecords();
  return () => {
    listeners.delete(onChange);
  };
}

/** Throws when the browser refuses storage; the caller shows an error. */
export function writeStoredRecords(records: readonly MismatchRecord[]): void {
  window.localStorage.setItem(MISMATCH_LEGACY_KEY, serializeMismatchPayload(records));
  notify();
}

export function clearAllStoredRecords(): void {
  try {
    window.localStorage.removeItem(MISMATCH_LEGACY_KEY);
  } catch {
    // Storage is refused, so nothing readable is left to clear.
  }
  notify();
}
