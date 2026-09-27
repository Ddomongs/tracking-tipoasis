import { expect, test } from "@playwright/test";
import { z } from "zod";
import {
  RESTORE_KEY,
  RESTORE_TTL_MS,
  clearRestoreEntry,
  currentNavigationKind,
  readRestoreEntry,
  saveRestoreEntry
} from "@/lib/privacy/session-restore";
import type { NavigationKind, RestoreEntry, StorageLike } from "@/lib/privacy/session-restore";
import { DELIVERY_CARRIER_CODES } from "@/lib/types";
import { FAKE, FIXTURE_NOW } from "../fixtures/tracking-fixtures";

class MemoryStorage implements StorageLike {
  private readonly items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  keys(): readonly string[] {
    return [...this.items.keys()];
  }
}

class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new DOMException("The operation is insecure.", "SecurityError");
  }

  setItem(): void {
    throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
  }

  removeItem(): void {
    throw new DOMException("The operation is insecure.", "SecurityError");
  }
}

const NOW = FIXTURE_NOW.getTime();
const ENTRY: RestoreEntry = { number: FAKE.domestic, carrier: "CJ", savedAt: NOW - 60_000 };

/** The schema the hand-written guard must agree with (spec: restore entries are zod-valid). */
const RestoreEntrySchema = z.object({
  number: z
    .string()
    .max(64)
    .refine((value) => value.trim().length > 0),
  carrier: z.enum(DELIVERY_CARRIER_CODES),
  savedAt: z.number().int().nonnegative()
});

test("key and lifetime follow the contract", () => {
  expect(RESTORE_KEY).toBe("tt:restore");
  expect(RESTORE_TTL_MS).toBe(30 * 60 * 1000);
});

test("a saved entry comes back on reload and back_forward", () => {
  const storage = new MemoryStorage();
  saveRestoreEntry(ENTRY, storage);
  expect(readRestoreEntry({ now: NOW, navigation: "reload" }, storage)).toEqual(ENTRY);
  expect(readRestoreEntry({ now: NOW, navigation: "back_forward" }, storage)).toEqual(ENTRY);
});

test("other navigations never restore and leave the entry alone", () => {
  const storage = new MemoryStorage();
  saveRestoreEntry(ENTRY, storage);
  const others: readonly NavigationKind[] = ["navigate", "prerender", "unknown"];
  for (const navigation of others) {
    expect(readRestoreEntry({ now: NOW, navigation }, storage), navigation).toBeNull();
  }
  expect(storage.getItem(RESTORE_KEY)).not.toBeNull();
});

test("the entry lives exactly 30 minutes, then it is removed", () => {
  const storage = new MemoryStorage();
  const entry: RestoreEntry = { ...ENTRY, savedAt: NOW - RESTORE_TTL_MS };
  saveRestoreEntry(entry, storage);
  expect(readRestoreEntry({ now: NOW, navigation: "reload" }, storage)).toEqual(entry);
  expect(readRestoreEntry({ now: NOW + 1, navigation: "reload" }, storage)).toBeNull();
  expect(storage.getItem(RESTORE_KEY)).toBeNull();
});

test("an entry saved in the future (clock moved back) is dropped", () => {
  const storage = new MemoryStorage();
  saveRestoreEntry({ ...ENTRY, savedAt: NOW + 1 }, storage);
  expect(readRestoreEntry({ now: NOW, navigation: "reload" }, storage)).toBeNull();
  expect(storage.getItem(RESTORE_KEY)).toBeNull();
});

test("saving again overwrites the single entry under the single key", () => {
  const storage = new MemoryStorage();
  saveRestoreEntry(ENTRY, storage);
  const second: RestoreEntry = { number: FAKE.hbl, carrier: "AUTO", savedAt: NOW - 1000 };
  saveRestoreEntry(second, storage);
  expect(storage.keys()).toEqual([RESTORE_KEY]);
  expect(readRestoreEntry({ now: NOW, navigation: "reload" }, storage)).toEqual(second);
});

test("stored values are accepted exactly when the zod schema accepts them; rejected ones are removed", () => {
  const candidates: readonly unknown[] = [
    ENTRY,
    { ...ENTRY, carrier: "AUTO" },
    { ...ENTRY, extra: true },
    { ...ENTRY, number: "" },
    { ...ENTRY, number: "   " },
    { ...ENTRY, number: "0".repeat(65) },
    { ...ENTRY, number: 12 },
    { ...ENTRY, carrier: "DHL" },
    { ...ENTRY, carrier: null },
    { ...ENTRY, savedAt: -1 },
    { ...ENTRY, savedAt: 1.5 },
    { ...ENTRY, savedAt: String(ENTRY.savedAt) },
    { number: ENTRY.number, carrier: ENTRY.carrier },
    null,
    42,
    "text",
    [ENTRY]
  ];
  for (const candidate of candidates) {
    const storage = new MemoryStorage();
    storage.setItem(RESTORE_KEY, JSON.stringify(candidate));
    const restored = readRestoreEntry({ now: NOW, navigation: "reload" }, storage);
    const valid = RestoreEntrySchema.safeParse(candidate).success;
    expect(restored !== null, JSON.stringify(candidate)).toBe(valid);
    if (!valid) expect(storage.getItem(RESTORE_KEY), JSON.stringify(candidate)).toBeNull();
  }
});

test("corrupted JSON is dropped and removed", () => {
  const storage = new MemoryStorage();
  storage.setItem(RESTORE_KEY, "{not json");
  expect(readRestoreEntry({ now: NOW, navigation: "reload" }, storage)).toBeNull();
  expect(storage.getItem(RESTORE_KEY)).toBeNull();
});

test("an invalid entry is never written", () => {
  const storage = new MemoryStorage();
  saveRestoreEntry({ ...ENTRY, number: "   " }, storage);
  saveRestoreEntry({ ...ENTRY, savedAt: -5 }, storage);
  saveRestoreEntry({ ...ENTRY, number: "0".repeat(65) }, storage);
  expect(storage.keys()).toEqual([]);
});

test("storage errors are swallowed", () => {
  const storage = new ThrowingStorage();
  expect(() => saveRestoreEntry(ENTRY, storage)).not.toThrow();
  expect(readRestoreEntry({ now: NOW, navigation: "reload" }, storage)).toBeNull();
  expect(() => clearRestoreEntry(storage)).not.toThrow();
});

test("no storage (null, or no window in this Node process) is a no-op", () => {
  expect(() => saveRestoreEntry(ENTRY, null)).not.toThrow();
  expect(readRestoreEntry({ now: NOW, navigation: "reload" }, null)).toBeNull();
  expect(() => saveRestoreEntry(ENTRY)).not.toThrow();
  expect(readRestoreEntry({ now: NOW, navigation: "reload" })).toBeNull();
  expect(() => clearRestoreEntry()).not.toThrow();
});

test("clearRestoreEntry removes the entry", () => {
  const storage = new MemoryStorage();
  saveRestoreEntry(ENTRY, storage);
  clearRestoreEntry(storage);
  expect(storage.keys()).toEqual([]);
});

test("currentNavigationKind is 'unknown' outside a browser", () => {
  expect(currentNavigationKind()).toBe("unknown");
});
