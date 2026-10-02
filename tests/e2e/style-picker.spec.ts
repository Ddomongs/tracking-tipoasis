import { expect, test, type Page } from "@playwright/test";
import { style as styleConfig } from "@/config/site.config";
import { PREPAINT_CSP_SOURCE, PREPAINT_SCRIPT, PREPAINT_SCRIPT_ID, PREPAINT_SCRIPT_SHA256 } from "@/lib/style/prepaint";
import { STYLE_IDS, STYLE_LABELS, STYLE_STORAGE_KEY, type StyleId } from "@/lib/style/styles";
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

const TOGGLE = { name: "어두운 화면" } as const;

function announcement(id: StyleId): string {
  return `화면 스타일을 ${STYLE_LABELS[id]}으로 바꿨어요`;
}

async function toggleStyle(page: Page): Promise<void> {
  await page.locator("header").getByRole("button", TOGGLE).click();
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/** 10월 2일 요청: the '화면 스타일' picker left the public pages; the header's round button is the one style switch. */
test.describe("header day/night switch (S08 picker rules, 10월 2일)", () => {
  test("no '화면 스타일' picker on any public page; the header switch is on each of them", async ({ page }) => {
    await mockTrack(page, trackData("delivered", { trackingNumber: FAKE.domestic }));
    for (const path of ["/", `/${FAKE.domestic}`, "/privacy", "/guide"]) {
      await page.goto(path);
      await expect(page.locator("[data-style-picker]"), path).toHaveCount(0);
      await expect(page.locator("header").getByRole("button", TOGGLE), path).toBeVisible();
    }
  });

  test("nothing is stored until the customer switches", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await expect(page.locator("header").getByRole("button", TOGGLE)).toHaveAttribute("aria-pressed", "false");
    expect(await page.evaluate((key) => window.localStorage.getItem(key), STYLE_STORAGE_KEY)).toBeNull();
  });

  test("switching applies the dark style at once, announces it once, remembers it and survives a reload", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const region = page.locator('[data-live-region="polite"]');
    await expect(region).toHaveText("");
    await toggleStyle(page);
    await expect(page.locator("html")).toHaveAttribute("data-style", "night");
    await expect(region).toHaveText(announcement("night"));
    expect(await page.evaluate((key) => window.localStorage.getItem(key), STYLE_STORAGE_KEY)).toBe("night");
    await recordStyleAtBody(page);
    await page.reload();
    expect(await styleAtBody(page)).toBe("night");
    await expect(page.locator('[data-live-region="polite"]')).toHaveText("");
  });

  test("keyboard: Enter and Space switch and each change is announced", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await page.locator("header").getByRole("button", TOGGLE).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-style", "night");
    await expect(page.locator('[data-live-region="polite"]')).toHaveText(announcement("night"));
    await page.keyboard.press("Space");
    await expect(page.locator("html")).toHaveAttribute("data-style", "signal");
    await expect(page.locator('[data-live-region="polite"]')).toHaveText(announcement("signal"));
  });

  test("a stored 서류형 still applies, and the switch goes from it to the dark style", async ({ page }) => {
    await storeStyle(page, "manifest");
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-style", "manifest");
    await toggleStyle(page);
    await expect(page.locator("html")).toHaveAttribute("data-style", "night");
  });

  test("storage that throws: the switch still changes the style for this page and announces it", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      // Next's development overlay is not part of the page; only application errors count.
      if (!/next-devtools|dev-overlay/.test(error.stack ?? "")) errors.push(error.message);
    });
    await page.emulateMedia({ colorScheme: "light" });
    await blockLocalStorage(page);
    await page.goto("/");
    await toggleStyle(page);
    await expect(page.locator("html")).toHaveAttribute("data-style", "night");
    await expect(page.locator('[data-live-region="polite"]')).toHaveText(announcement("night"));
    expect(errors).toEqual([]);
  });

  test("a style change keeps the result's structure, hooks and copy", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await mockTrack(page, trackData("delivered", { trackingNumber: FAKE.domestic }));
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-result-view="settled"]')).toBeVisible();
    await page.waitForLoadState("networkidle");
    const snapshot = (): Promise<{ readonly text: string; readonly hooks: string }> =>
      page.locator("[data-view-state]").evaluate((root) => ({
        text: root.textContent ?? "",
        hooks: Array.from(root.querySelectorAll("*"), (element) =>
          Array.from(element.attributes)
            .filter((attribute) => attribute.name.startsWith("data-"))
            .map((attribute) => `${attribute.name}=${attribute.value}`)
            .join(" ")
        ).join("|")
      }));
    const before = await snapshot();
    for (const id of ["night", "signal"] as const) {
      await toggleStyle(page);
      await expect(page.locator("html")).toHaveAttribute("data-style", id);
      expect(await snapshot(), id).toEqual(before);
    }
  });

  for (const id of STYLE_IDS) {
    test(`320 px in ${id}: no horizontal scroll on the home and on a long-number result`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await storeStyle(page, id);
      await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.cargo }));
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-style", id);
      expect(await horizontalOverflow(page), `${id} home`).toBeLessThanOrEqual(0);
      await page.goto(`/${FAKE.cargo}`);
      await expect(page.locator("[data-result-view] h2")).toBeVisible();
      expect(await horizontalOverflow(page), `${id} result`).toBeLessThanOrEqual(0);
    });
  }

  test("the choice never leaves the browser: no request carries it", async ({ page }) => {
    const carried: string[] = [];
    page.on("request", (request) => {
      const text = `${request.url()} ${request.postData() ?? ""}`;
      if (text.includes(STYLE_STORAGE_KEY) || text.includes(encodeURIComponent(STYLE_STORAGE_KEY))) carried.push(request.url());
    });
    await page.goto("/");
    await toggleStyle(page);
    await mockTrack(page, trackData("delivered", { trackingNumber: FAKE.domestic }));
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-result-view="settled"]')).toBeVisible();
    expect(carried).toEqual([]);
  });
});
