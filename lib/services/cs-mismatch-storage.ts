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

export const readStoredRecords = (): MismatchRecord[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(CUSTOMS_MISMATCH_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MismatchRecord[]) : [];
  } catch {
    return [];
  }
};

export const writeStoredRecords = (records: MismatchRecord[]): void => {
  window.localStorage.setItem(CUSTOMS_MISMATCH_STORAGE_KEY, JSON.stringify(records));
};
