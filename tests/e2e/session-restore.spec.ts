import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { RESTORE_KEY, RESTORE_TTL_MS } from "@/lib/privacy/session-restore";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, mockTrack, trackDataAtRealTime } from "../fixtures/tracking-fixtures";
import { recordLookups, waitForIdle } from "../support/network-capture";
import type { LookupRecorder } from "../support/network-capture";

const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const RESULT_READY = { name: "다시 볼 링크 복사" } as const;

function inTransit(number: string): TrackResponseData {
  // Restore needs the real clock (see trackDataAtRealTime), so the result is dated relative to it.
  return trackDataAtRealTime("inTransit", { trackingNumber: number });
}

async function submitFromHome(page: Page, number: string): Promise<void> {
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await input.fill(number);
  await input.press("Enter");
  await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
}

async function expectPath(page: Page, expected: string): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => `${location.pathname}${location.search}${location.hash}`), { timeout: 10_000 })
    .toBe(expected);
}

async function storedEntry(page: Page): Promise<string | null> {
  return page.evaluate((key) => sessionStorage.getItem(key), RESTORE_KEY);
}

async function writeEntry(
  page: Page,
  entry: { readonly number: string; readonly carrier: string; readonly ageMs: number }
): Promise<void> {
  await page.evaluate(
    ({ key, number, carrier, ageMs }) =>
      sessionStorage.setItem(key, JSON.stringify({ number, carrier, savedAt: Date.now() - ageMs })),
    { key: RESTORE_KEY, ...entry }
  );
}

async function expectNoRestore(page: Page, lookups: LookupRecorder, lookupsBefore: number): Promise<void> {
  await waitForIdle(page);
  expect(lookups.numbers()).toHaveLength(lookupsBefore);
  await expect(page.getByRole("button", RESULT_READY)).toHaveCount(0);
}

test("a lookup on '/' comes back after a reload, with its carrier", async ({ page }) => {
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
  await page.goto("/");
  await submitFromHome(page, FAKE.domestic);
  await page.reload();
  await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
  await expectPath(page, "/");
  expect(lookups.numbers()).toEqual([FAKE.domestic, FAKE.domestic]);
  expect(lookups.carriers()).toEqual(["AUTO", "AUTO"]);
});

test("the restored lookup uses the stored carrier", async ({ page }) => {
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.hbl), { onRequest: lookups.onRequest });
  await page.goto("/");
  await writeEntry(page, { number: FAKE.hbl, carrier: "CJ", ageMs: 1000 });
  await page.reload();
  await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
  expect(lookups.numbers()).toEqual([FAKE.hbl]);
  expect(lookups.carriers()).toEqual(["CJ"]);
});

test("back_forward restores after leaving for another document", async ({ page }) => {
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
  await page.goto("/");
  await submitFromHome(page, FAKE.domestic);
  await page.goto("/privacy");
  await page.goBack();
  await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
  await expectPath(page, "/");
  expect(lookups.numbers()).toEqual([FAKE.domestic, FAKE.domestic]);
});

test("a fresh navigation to '/' does not restore", async ({ page }) => {
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
  await page.goto("/");
  await submitFromHome(page, FAKE.domestic);
  await page.goto("/");
  await expectNoRestore(page, lookups, 1);
  expect(await storedEntry(page)).not.toBeNull();
});

test("a new tab starts empty, even when it reloads", async ({ page, context }) => {
  await mockTrack(page, inTransit(FAKE.domestic));
  await page.goto("/");
  await submitFromHome(page, FAKE.domestic);
  const second = await context.newPage();
  const secondLookups = recordLookups();
  await mockTrack(second, inTransit(FAKE.domestic), { onRequest: secondLookups.onRequest });
  await second.goto("/");
  await second.reload();
  await expectNoRestore(second, secondLookups, 0);
  expect(await storedEntry(second)).toBeNull();
});

test("an entry older than 30 minutes is dropped", async ({ page }) => {
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
  await page.goto("/");
  await writeEntry(page, { number: FAKE.domestic, carrier: "AUTO", ageMs: RESTORE_TTL_MS + 1000 });
  await page.reload();
  await expectNoRestore(page, lookups, 0);
  expect(await storedEntry(page)).toBeNull();
});

test("a corrupted entry is dropped", async ({ page }) => {
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
  await page.goto("/");
  await page.evaluate((key) => sessionStorage.setItem(key, "{not json"), RESTORE_KEY);
  await page.reload();
  await expectNoRestore(page, lookups, 0);
  expect(await storedEntry(page)).toBeNull();
});

test("one entry per tab: the last lookup wins", async ({ page }) => {
  await mockTrack(page, inTransit(FAKE.domestic));
  await page.goto("/");
  await submitFromHome(page, FAKE.domestic);
  await page.goto("/");
  await submitFromHome(page, FAKE.hbl);
  const keys = await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith("tt:")));
  expect(keys).toEqual([RESTORE_KEY]);
  expect(await storedEntry(page)).toContain(`"number":"${FAKE.hbl}"`);
});

test("blocked sessionStorage never breaks the lookup, the scrub or a reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get: () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      }
    });
  });
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
  await page.goto(`/${FAKE.domestic}`);
  await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
  await expectPath(page, "/");
  await page.reload();
  await expectNoRestore(page, lookups, 1);
  await expect(page.getByLabel(INPUT_LABEL, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a full sessionStorage (setItem throws) never breaks the lookup or a reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const real = window.sessionStorage;
    const full = {
      get length(): number {
        return real.length;
      },
      clear: (): void => real.clear(),
      key: (index: number): string | null => real.key(index),
      getItem: (key: string): string | null => real.getItem(key),
      setItem: (): void => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
      removeItem: (key: string): void => real.removeItem(key)
    };
    Object.defineProperty(window, "sessionStorage", { configurable: true, get: () => full });
  });
  const lookups = recordLookups();
  await mockTrack(page, inTransit(FAKE.domestic), { onRequest: lookups.onRequest });
  await page.goto("/");
  await submitFromHome(page, FAKE.domestic);
  await page.reload();
  await expectNoRestore(page, lookups, 1);
  expect(errors).toEqual([]);
});
