import { expect, test, type Page } from "@playwright/test";
import { channels, lookup, stateGuide } from "@/config/site.config";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, FAKE_GROUPED, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { waitForIdle } from "../support/network-capture";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";

const RESULT_READY = { name: "다시 볼 링크 복사" } as const;
const TITLE_SUFFIX = " · 배송 조회";
const LOADING_TITLE = `${stateGuide.loading.docTitle}${TITLE_SUFFIX}`;
const INVALID_TITLE = `${stateGuide.invalidNumber.docTitle}${TITLE_SUFFIX}`;
const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";

const toFullWidth = (value: string): string =>
  value.replace(/[!-~]/g, (character) => String.fromCharCode(character.charCodeAt(0) + 0xfee0));

async function recordTrack(page: Page, options: { readonly delayMs?: number; readonly data?: TrackResponseData } = {}): Promise<unknown[]> {
  const bodies: unknown[] = [];
  await mockTrack(page, options.data ?? trackData("inTransit", { trackingNumber: FAKE.domestic }), {
    delayMs: options.delayMs ?? 0,
    onRequest: (body) => bodies.push(body)
  });
  return bodies;
}

async function activeTag(page: Page): Promise<string> {
  return page.evaluate(() => document.activeElement?.tagName ?? "");
}

test.describe("server shell without JavaScript (S06)", () => {
  test.use({ javaScriptEnabled: false });

  test("a valid number is painted as the number bar and '조회하고 있어요' from the server HTML", async ({ page }) => {
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-view-state="loading"]')).toHaveCount(1);
    const bar = page.locator('[data-number-bar="true"]');
    await expect(bar).toContainText(FAKE_GROUPED.domestic);
    await expect(bar).toContainText(lookup.copy.carrierAuto);
    await expect(page.getByRole("heading", { level: 2, name: lookup.copy.title })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "배송 조회 결과" })).toHaveCount(1);
    expect(await page.title()).toBe(LOADING_TITLE);
  });

  test("?c= carries the carrier into the number bar", async ({ page }) => {
    await page.goto(`/${FAKE.hbl}?c=cj`);
    const bar = page.locator('[data-number-bar="true"]');
    await expect(bar).toContainText(FAKE_GROUPED.hbl);
    await expect(bar).toContainText("CJ대한통운");
  });

  test("an alphanumeric path that is not a number renders the INVALID screen", async ({ page }) => {
    const response = await page.goto(`/${FAKE.deepLinkInvalid}`);
    expect(response?.status()).toBe(200);
    const input = page.getByRole("textbox", { name: INPUT_LABEL, exact: true });
    await expect(input).toHaveValue(FAKE.deepLinkInvalid);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator('[data-guide-key="invalidNumber"] [role="alert"]')).toHaveText(stateGuide.invalidNumber.title);
    await expect(page.locator('[data-view-state="error"]')).toHaveCount(1);
    expect(await page.title()).toBe(INVALID_TITLE);
  });
});

test.describe("three-way split (S06)", () => {
  test("path variants normalize to one lookup", async ({ page }) => {
    const bodies = await recordTrack(page);
    const variants: ReadonlyArray<readonly [string, string]> = [
      [FAKE.hbl.toLowerCase(), FAKE.hbl],
      [encodeURIComponent(FAKE_GROUPED.domestic), FAKE.domestic],
      [FAKE_GROUPED.domestic.replaceAll(" ", "-"), FAKE.domestic],
      [encodeURIComponent(toFullWidth(FAKE.domestic)), FAKE.domestic]
    ];
    for (const [path] of variants) {
      await page.goto(`/${path}`);
      await expect(page.getByRole("button", RESULT_READY), path).toBeVisible();
    }
    expect(bodies).toEqual(variants.map(([, number]) => ({ trackingNumber: number, carrierCode: "AUTO" })));
  });

  test("?c= is sent with the lookup and unknown values fall back to AUTO", async ({ page }) => {
    const bodies = await recordTrack(page);
    await page.goto(`/${FAKE.hbl}?c=CJ`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await page.goto(`/${FAKE.hbl}?c=NOPE`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    expect(bodies).toEqual([
      { trackingNumber: FAKE.hbl, carrierCode: "CJ" },
      { trackingNumber: FAKE.hbl, carrierCode: "AUTO" }
    ]);
  });

  test("an invalid alphanumeric path never calls the API", async ({ page }) => {
    const bodies = await recordTrack(page);
    await page.goto(`/${FAKE.deepLinkInvalid}`);
    await expect(page.locator('[data-view-state="error"]')).toHaveCount(1);
    const cta = page.locator('[data-cta-state="error"]');
    await expect(cta.getByRole("link").first()).toHaveAccessibleName(`${channels.talk.labels.cta} 새 창으로 열기`);
    await waitForIdle(page);
    expect(bodies).toEqual([]);
    await expect(page.getByRole("button", RESULT_READY)).toHaveCount(0);
  });

  test("other shapes are a real 404 without a lookup", async ({ request }) => {
    for (const path of ["/a.b", `/${encodeURIComponent("한글")}`, `/${"0".repeat(31)}`, "/ABCDE"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
    }
  });

  test("a trailing slash redirects to the number path", async ({ request }) => {
    const response = await request.get(`/${FAKE.domestic}/`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(new URL(response.headers()["location"] ?? "", "http://127.0.0.1:43210").pathname).toBe(`/${FAKE.domestic}`);
  });

  test("number-like responses are noindex and titled without the number", async ({ request }) => {
    for (const [path, title] of [
      [`/${FAKE.domestic}`, LOADING_TITLE],
      [`/${FAKE.deepLinkInvalid}`, INVALID_TITLE]
    ] as const) {
      const response = await request.get(path);
      expect(response.headers()["x-robots-tag"] ?? "", path).toContain("noindex");
      const html = await response.text();
      expect(html, path).toMatch(/<meta name="robots" content="noindex, nofollow"/);
      expect(/<title>([^<]*)<\/title>/.exec(html)?.[1], path).toBe(title);
    }
  });
});

test.describe("after the lookup (S06)", () => {
  test("focus moves to the status heading when the customer has not interacted", async ({ page }) => {
    await recordTrack(page, { delayMs: 300 });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expect.poll(() => activeTag(page)).toBe("H2");
  });

  test("focus stays where the customer is when they interacted during loading", async ({ page }) => {
    await recordTrack(page, { delayMs: 1500 });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-view-state="loading"]')).toHaveCount(1);
    await page.keyboard.press("Shift");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await page.waitForTimeout(300);
    expect(await activeTag(page)).not.toBe("H2");
  });

  test("one live region hears the start and the result, once each", async ({ page }) => {
    await page.addInitScript(() => {
      const heard: string[] = [];
      (window as unknown as { __ttLive: string[] }).__ttLive = heard;
      let last = "";
      new MutationObserver(() => {
        const text = document.querySelector('[data-live-region="polite"]')?.textContent?.trim() ?? "";
        if (text === last) return;
        if (text !== "") heard.push(text);
        last = text;
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    await recordTrack(page, { delayMs: 1000 });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await page.waitForTimeout(300);
    const heard = await page.evaluate(() => (window as unknown as { __ttLive: string[] }).__ttLive);
    expect(heard).toHaveLength(2);
    expect(heard[0]).toBe(lookup.copy.started);
  });

  test("the document title follows the result and never contains the number", async ({ page }) => {
    await recordTrack(page);
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expect.poll(() => page.title()).not.toBe(LOADING_TITLE);
    const title = await page.title();
    expect(title.endsWith(TITLE_SUFFIX)).toBe(true);
    expect(title).not.toMatch(/\d{4}/);
  });

  test("[번호 변경] on a deep link opens the form with the number", async ({ page }) => {
    await recordTrack(page, { delayMs: 5000 });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-number-bar="true"]')).toBeVisible();
    await page.getByRole("button", { name: "번호 변경" }).click();
    const input = page.getByRole("textbox", { name: INPUT_LABEL, exact: true });
    await expect(input).toHaveValue(FAKE.domestic);
    await expect(input).toBeFocused();
    await expect(page.locator('[data-view-state="idle"]')).toHaveCount(1);
  });

  test("an 18-digit cargo number at 320 px scrolls nowhere", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await recordTrack(page, { delayMs: 5000 });
    await page.goto(`/${FAKE.cargo}`);
    await expect(page.locator('[data-number-bar="true"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe("production caching (S06)", () => {
  test.skip(!IS_PRODUCTION_RUN, "next dev overrides Cache-Control on pages");

  test("number routes are private and never stored", async ({ request }) => {
    for (const path of [`/${FAKE.domestic}`, `/${FAKE.deepLinkInvalid}`]) {
      const cacheControl = (await request.get(path)).headers()["cache-control"] ?? "";
      expect(cacheControl, path).toContain("private");
      expect(cacheControl, path).toContain("no-store");
    }
  });
});
