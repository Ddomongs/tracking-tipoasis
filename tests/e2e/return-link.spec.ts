import { devices, expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { buildReturnLink } from "@/lib/site";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";

// The fixtures' dates: on a later real day these results turn overdue and the return link is withheld, so pin the clock.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
});

const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const RETURN_LINK = { name: "다시 볼 링크 복사" } as const;

type ShareMode = "resolve" | "abort" | "deny";

function inTransitWith(carrierCode: "AUTO" | "CJ"): TrackResponseData {
  const base = trackData("inTransit", { trackingNumber: FAKE.domestic });
  return {
    ...base,
    delivery: { ...base.delivery, carrierCode, carrier: carrierCode === "CJ" ? "CJ대한통운" : "택배사 자동 확인" }
  };
}

async function lookUpFromHome(page: Page, number: string): Promise<void> {
  await page.goto("/");
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await input.fill(number);
  await input.press("Enter");
  await expect(page.getByRole("button", RETURN_LINK)).toBeVisible();
}

async function removeShareSheet(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
}

async function stubMobileShare(page: Page, mode: ShareMode): Promise<void> {
  await page.addInitScript((shareMode: string) => {
    const shareUrls: string[] = [];
    const clipboardWrites: string[] = [];
    Object.defineProperty(window, "__ttShareUrls", { value: shareUrls });
    Object.defineProperty(window, "__ttClipboardWrites", { value: clipboardWrites });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: (): boolean => true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (data: ShareData): Promise<void> => {
        shareUrls.push(String(data.url));
        if (shareMode === "abort") return Promise.reject(new DOMException("Share canceled.", "AbortError"));
        if (shareMode === "deny") return Promise.reject(new DOMException("Permission denied.", "NotAllowedError"));
        return Promise.resolve();
      }
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string): Promise<void> => {
          clipboardWrites.push(text);
          return Promise.resolve();
        }
      }
    });
  }, mode);
}

async function recorded(page: Page, key: "__ttShareUrls" | "__ttClipboardWrites"): Promise<readonly string[]> {
  return page.evaluate((name) => {
    const value: unknown = Reflect.get(window, name);
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
  }, key);
}

test.describe("desktop", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("copies a link that reopens this result", async ({ page }) => {
    await removeShareSheet(page);
    await mockTrack(page, inTransitWith("AUTO"));
    await lookUpFromHome(page, FAKE.domestic);
    await page.getByRole("button", RETURN_LINK).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(buildReturnLink(FAKE.domestic, "AUTO"));
  });

  test("keeps the carrier in the link", async ({ page }) => {
    await removeShareSheet(page);
    await mockTrack(page, inTransitWith("CJ"));
    await page.goto(`/${FAKE.domestic}?c=CJ`);
    await page.getByRole("button", RETURN_LINK).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(buildReturnLink(FAKE.domestic, "CJ"));
  });
});

test("falls back to a read-only, pre-selected link box when copying is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (): Promise<void> => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError"))
      }
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: (): boolean => false });
  });
  await mockTrack(page, inTransitWith("AUTO"));
  await lookUpFromHome(page, FAKE.domestic);
  await page.getByRole("button", RETURN_LINK).click();
  const link = buildReturnLink(FAKE.domestic, "AUTO");
  const box = page.locator("textarea[readonly]");
  await expect(box).toHaveValue(link);
  await expect
    .poll(() =>
      box.evaluate((element) => (element instanceof HTMLTextAreaElement ? element.selectionEnd - element.selectionStart : -1))
    )
    .toBe(link.length);
});

test.describe("mobile: share sheet first", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: devices["Pixel 7"].userAgent
  });

  test("opens the share sheet with the return link instead of copying", async ({ page }) => {
    await stubMobileShare(page, "resolve");
    await mockTrack(page, inTransitWith("AUTO"));
    await lookUpFromHome(page, FAKE.domestic);
    await page.getByRole("button", RETURN_LINK).click();
    await expect.poll(() => recorded(page, "__ttShareUrls")).toEqual([buildReturnLink(FAKE.domestic, "AUTO")]);
    expect(await recorded(page, "__ttClipboardWrites")).toEqual([]);
  });

  test("a dismissed share sheet changes nothing", async ({ page }) => {
    await stubMobileShare(page, "abort");
    await mockTrack(page, inTransitWith("AUTO"));
    await lookUpFromHome(page, FAKE.domestic);
    await page.getByRole("button", RETURN_LINK).click();
    await expect.poll(() => recorded(page, "__ttShareUrls")).toHaveLength(1);
    expect(await recorded(page, "__ttClipboardWrites")).toEqual([]);
    await expect(page.locator("textarea[readonly]")).toHaveCount(0);
  });

  test("a denied share sheet falls back to copying", async ({ page }) => {
    await stubMobileShare(page, "deny");
    await mockTrack(page, inTransitWith("AUTO"));
    await lookUpFromHome(page, FAKE.domestic);
    await page.getByRole("button", RETURN_LINK).click();
    await expect.poll(() => recorded(page, "__ttClipboardWrites")).toEqual([buildReturnLink(FAKE.domestic, "AUTO")]);
  });
});
