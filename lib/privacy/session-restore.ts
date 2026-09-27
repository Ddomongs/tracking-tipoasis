import { DELIVERY_CARRIER_CODES } from "@/lib/types";
import type { DeliveryCarrierCode } from "@/lib/types";

/**
 * Tab-only restore of the last lookup (spec §3): sessionStorage, one entry, 30 minutes,
 * restored only on reload and back_forward navigations. Browser only; storage errors are swallowed.
 * Validation mirrors a zod schema by hand (parity is unit-tested) so zod stays out of the initial bundle.
 */
export const RESTORE_KEY = "tt:restore";
export const RESTORE_TTL_MS = 1800000;

export interface RestoreEntry {
  readonly number: string;
  readonly carrier: DeliveryCarrierCode;
  readonly savedAt: number;
}

export type NavigationKind = "navigate" | "reload" | "back_forward" | "prerender" | "unknown";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const MAX_NUMBER_LENGTH = 64;
const RESTORABLE_NAVIGATIONS: ReadonlySet<NavigationKind> = new Set<NavigationKind>(["reload", "back_forward"]);

export function currentNavigationKind(): NavigationKind {
  try {
    if (typeof performance === "undefined" || typeof PerformanceNavigationTiming === "undefined") return "unknown";
    const [entry] = performance.getEntriesByType("navigation");
    if (!(entry instanceof PerformanceNavigationTiming)) return "unknown";
    switch (entry.type) {
      case "navigate":
      case "reload":
      case "back_forward":
      case "prerender":
        return entry.type;
      default:
        return "unknown";
    }
  } catch {
    return "unknown";
  }
}

function isCarrierCode(value: string): value is DeliveryCarrierCode {
  return DELIVERY_CARRIER_CODES.some((code) => code === value);
}

function toRestoreEntry(value: unknown): RestoreEntry | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("number" in value) || !("carrier" in value) || !("savedAt" in value)) return null;
  const { number, carrier, savedAt } = value;
  if (typeof number !== "string" || number.trim().length === 0 || number.length > MAX_NUMBER_LENGTH) return null;
  if (typeof carrier !== "string" || !isCarrierCode(carrier)) return null;
  if (typeof savedAt !== "number" || !Number.isInteger(savedAt) || savedAt < 0) return null;
  return { number, carrier, savedAt };
}

function parseJson(raw: string): unknown {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

function sessionStore(storage: StorageLike | null | undefined): StorageLike | null {
  if (storage !== undefined) return storage;
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveRestoreEntry(entry: RestoreEntry, storage?: StorageLike | null): void {
  const valid = toRestoreEntry(entry);
  const target = sessionStore(storage);
  if (!valid || !target) return;
  try {
    target.setItem(RESTORE_KEY, JSON.stringify(valid));
  } catch {
    // Quota, private mode or blocked storage: restore is a convenience.
  }
}

export function readRestoreEntry(
  input: { readonly now: number; readonly navigation: NavigationKind },
  storage?: StorageLike | null
): RestoreEntry | null {
  if (!RESTORABLE_NAVIGATIONS.has(input.navigation)) return null;
  const target = sessionStore(storage);
  if (!target) return null;
  try {
    const raw = target.getItem(RESTORE_KEY);
    if (raw === null) return null;
    const entry = toRestoreEntry(parseJson(raw));
    if (entry) {
      const age = input.now - entry.savedAt;
      if (age >= 0 && age <= RESTORE_TTL_MS) return entry;
    }
    target.removeItem(RESTORE_KEY);
    return null;
  } catch {
    return null;
  }
}

export function clearRestoreEntry(storage?: StorageLike | null): void {
  const target = sessionStore(storage);
  if (!target) return;
  try {
    target.removeItem(RESTORE_KEY);
  } catch {
    // Blocked storage has nothing to clear.
  }
}
