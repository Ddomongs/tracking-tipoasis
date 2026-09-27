import { expect, test, type Page } from "@playwright/test";
import { style as styleConfig } from "@/config/site.config";
import { PREPAINT_CSP_SOURCE, PREPAINT_SCRIPT, PREPAINT_SCRIPT_ID, PREPAINT_SCRIPT_SHA256 } from "@/lib/style/prepaint";
import { STYLE_STORAGE_KEY } from "@/lib/style/styles";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";

type StyleProbeWindow = Window & { __ttStyleAtBody?: string | null };

/** Records html[data-style] when <body> first appears — before anything in the body can be painted. */
async function recordStyleAtBody(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (document.body === null) return;
      (window as StyleProbeWindow).__ttStyleAtBody = document.documentElement.getAttribute("data-style");
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}

async function styleAtBody(page: Page): Promise<string | null | undefined> {
  return page.evaluate(() => (window as StyleProbeWindow).__ttStyleAtBody);
}

async function storeStyle(page: Page, value: string): Promise<void> {
  await page.addInitScript(
    ([key, stored]) => {
      try {
        window.localStorage.setItem(key, stored);
      } catch {
        // storage blocked: the test that needs it fails on the style check instead
      }
    },
    [STYLE_STORAGE_KEY, value] as const
  );
}

/** Naver/Kakao in-app browsers and some private windows throw on any localStorage access. */
async function blockLocalStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      }
    });
  });
}

async function blockThirdParty(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

const DARK_FIRST_VISIT = styleConfig.followSystemDark ? "night" : "signal";

test.beforeEach(async ({ page }) => {
  await blockThirdParty(page);
});

test.describe("pre-paint style script (S08)", () => {
  test("the server renders the default style, the follow-dark flag and the script in <head> before <body>", async ({ request }) => {
    const html = await (await request.get("/")).text();
    expect(html).toMatch(/<html[^>]*\sdata-style="signal"/);
    expect(html).toMatch(new RegExp(`<html[^>]*\\sdata-follow-dark="${styleConfig.followSystemDark ? "1" : "0"}"`));
    const scriptAt = html.indexOf(`<script id="${PREPAINT_SCRIPT_ID}">`);
    expect(scriptAt).toBeGreaterThan(-1);
    expect(scriptAt).toBeLessThan(html.indexOf("<body"));
    expect(html).toContain(PREPAINT_SCRIPT);
  });

  test("the page's Report-Only CSP carries the script's hash, and the served script text hashes to it", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.headers()["content-security-policy-report-only"]).toContain(PREPAINT_CSP_SOURCE);
    const digest = await page.evaluate(async (id) => {
      const text = document.getElementById(id)?.textContent ?? "";
      const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }, PREPAINT_SCRIPT_ID);
    expect(digest).toBe(PREPAINT_SCRIPT_SHA256);
  });

  test("first visit on a light device: 기본 (signal) before the body appears", async ({ page }) => {
    await recordStyleAtBody(page);
    await page.goto("/");
    expect(await styleAtBody(page)).toBe("signal");
    await expect(page.locator("html")).toHaveAttribute("data-style", "signal");
  });

  test("an unknown stored value falls back to the first-visit rule", async ({ page }) => {
    await storeStyle(page, "dark");
    await recordStyleAtBody(page);
    await page.goto("/");
    expect(await styleAtBody(page)).toBe("signal");
  });

  test("storage that throws: the first-visit rule still applies, nothing breaks and a lookup still works", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      // Next's development overlay is not part of the page; only application errors count.
      if (!/next-devtools|dev-overlay/.test(error.stack ?? "")) errors.push(error.message);
    });
    await blockLocalStorage(page);
    await recordStyleAtBody(page);
    await mockTrack(page, trackData("delivered", { trackingNumber: FAKE.domestic }));
    await page.goto(`/${FAKE.domestic}`);
    expect(await styleAtBody(page)).toBe("signal");
    await expect(page.locator('[data-result-view="settled"]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test.describe("on a dark device", () => {
    test.use({ colorScheme: "dark" });

    test("first visit starts in 어두운 화면 (night) before the body appears when the config follows the device", async ({ page }) => {
      await recordStyleAtBody(page);
      await page.goto("/");
      expect(await styleAtBody(page)).toBe(DARK_FIRST_VISIT);
    });

    test("a stored choice wins over the dark device", async ({ page }) => {
      await storeStyle(page, "manifest");
      await recordStyleAtBody(page);
      await page.goto("/");
      expect(await styleAtBody(page)).toBe("manifest");
    });

    test("storage that throws still follows the dark device", async ({ page }) => {
      await blockLocalStorage(page);
      await recordStyleAtBody(page);
      await page.goto("/");
      expect(await styleAtBody(page)).toBe(DARK_FIRST_VISIT);
    });
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false, colorScheme: "dark" });

    test("the page keeps the server default", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-style", "signal");
    });
  });
});
