import type { CustomsMismatchTemplateKey } from "@/lib/services/cs-reply-template";

export const CUSTOMS_MISMATCH_STORAGE_KEY = "tracking-tipoasis:customs-mismatch-records";

export type MismatchRecord = {
  id: string;
  phone: string;
  content: string;
  trackingMemo: string;
  templateKey: CustomsMismatchTemplateKey;
  createdAt: string;
  updatedAt?: string;
};

export const createRecordId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizePhone = (value: string): string => value.replace(/[^\d-]/g, "").trim();

const EMPTY_RECORDS: MismatchRecord[] = [];
const recordListeners = new Set<() => void>();

// useSyncExternalStore needs a stable reference, so re-parse only when the stored JSON changes.
let snapshotRaw: string | null = null;
let snapshotRecords: MismatchRecord[] = EMPTY_RECORDS;

const readRawRecords = (): string | null => {
  try {
    return window.localStorage.getItem(CUSTOMS_MISMATCH_STORAGE_KEY);
  } catch {
    return null;
  }
};

const parseRecords = (raw: string | null): MismatchRecord[] => {
  if (!raw) return EMPTY_RECORDS;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MismatchRecord[]) : EMPTY_RECORDS;
  } catch {
    return EMPTY_RECORDS;
  }
};

export const getStoredRecordsSnapshot = (): MismatchRecord[] => {
  const raw = readRawRecords();
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshotRecords = parseRecords(raw);
  }
  return snapshotRecords;
};

export const getServerStoredRecordsSnapshot = (): MismatchRecord[] => EMPTY_RECORDS;

export const subscribeStoredRecords = (onChange: () => void): (() => void) => {
  recordListeners.add(onChange);
  return () => {
    recordListeners.delete(onChange);
  };
};

export const writeStoredRecords = (records: MismatchRecord[]): void => {
  window.localStorage.setItem(CUSTOMS_MISMATCH_STORAGE_KEY, JSON.stringify(records));
  recordListeners.forEach((onChange) => onChange());
};
