import { expect, test, type Page } from "@playwright/test";
import { STYLE_COLOR_TOKENS, contrastRatio } from "@/lib/style/tokens";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";

// Basic-auth credentials are sent only when a route challenges (the /internal/* pages).
test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

test.describe("root layout wiring", () => {
  test("pages render html[data-style=signal] with the signal tokens and only the DM Mono web font", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-style", "signal");
    const ground = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--tt-ground").trim().toUpperCase()
    );
    expect(ground).toBe(STYLE_COLOR_TOKENS.signal?.["--tt-ground"]);
    const families = await page.evaluate(async () => {
      await document.fonts.ready;
      return Array.from(document.fonts, (font) => font.family);
    });
    expect(families.some((family) => /DM[_ ]Mono/.test(family))).toBe(true);
    expect(families.filter((family) => /IBM[_ ]Plex|Space[_ ]Grotesk/.test(family))).toEqual([]);
    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(bodyFont).toMatch(/Apple SD Gothic Neo|Malgun Gothic/);
  });
});

const UI_KIT_PATH = "/internal/ui-kit";

async function openKit(page: Page, width = 1280, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(UI_KIT_PATH);
  await expect(page.locator("main[data-ui-kit]")).toBeVisible();
}

interface TextSample {
  readonly text: string;
  readonly fg: string;
  readonly bg: string;
  readonly size: number;
}

/** Every visible text node in the gallery with its color, the nearest opaque background and its font size. */
async function visibleTextSamples(page: Page): Promise<readonly TextSample[]> {
  return page.evaluate(() => {
    const toHex = (value: string): string | null => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      if (parts.length > 3 && parts[3] === 0) return null;
      return `#${parts
        .slice(0, 3)
        .map((part) => Math.round(part).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`;
    };
    const samples: { text: string; fg: string; bg: string; size: number }[] = [];
    const root = document.querySelector("main[data-ui-kit]");
    if (!root) return samples;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? "").trim();
      const parent = node.parentElement;
      if (!text || !parent || parent.closest(".sr-only")) continue;
      let bg: string | null = null;
      for (let element: Element | null = parent; element && !bg; element = element.parentElement) {
        bg = toHex(getComputedStyle(element).backgroundColor);
      }
      const style = getComputedStyle(parent);
      samples.push({ text: text.slice(0, 40), fg: toHex(style.color) ?? "#000000", bg: bg ?? "#FFFFFF", size: Number.parseFloat(style.fontSize) });
    }
    return samples;
  });
}

interface FocusProbe {
  readonly name: string;
  readonly style: string;
  readonly width: number;
  readonly ring: string | null;
  readonly background: string;
}

/** The focused element inside the gallery, its outline and the nearest opaque background around it. */
async function probeFocused(page: Page): Promise<FocusProbe | null> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || !element.closest("main[data-ui-kit]")) return null;
    const toHex = (value: string): string | null => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      if (parts.length > 3 && parts[3] === 0) return null;
      return `#${parts
        .slice(0, 3)
        .map((part) => Math.round(part).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`;
    };
    let background: string | null = null;
    for (let node = element.parentElement; node && !background; node = node.parentElement) {
      background = toHex(getComputedStyle(node).backgroundColor);
    }
    const style = getComputedStyle(element);
    return {
      name: (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 40),
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
      ring: toHex(style.outlineColor),
      background: background ?? "#FFFFFF"
    };
  });
}

test.describe("ui-kit gallery", () => {
  test("is served behind internal auth with one main landmark and its title", async ({ page }) => {
    const response = await page.goto(UI_KIT_PATH);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "화면 부품 모음" })).toBeVisible();
  });

  test("no text is 11px or smaller", async ({ page }) => {
    await openKit(page, 375, 812);
    const tiny = (await visibleTextSamples(page)).filter((sample) => sample.size <= 11).map((sample) => `${sample.size}px ${sample.text}`);
    expect(tiny).toEqual([]);
  });

  test("every visible text is at least 4.5:1 against its background", async ({ page }) => {
    await openKit(page, 375, 812);
    const failures = (await visibleTextSamples(page))
      .map((sample) => ({ ...sample, ratio: contrastRatio(sample.fg, sample.bg) }))
      .filter((sample) => sample.ratio < 4.5)
      .map((sample) => `${sample.text}: ${sample.fg} on ${sample.bg} = ${sample.ratio.toFixed(2)}`);
    expect(failures).toEqual([]);
  });

  test("320px wide: no horizontal scroll", async ({ page }) => {
    await openKit(page, 320, 800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("every focusable element shows a 3px focus ring at 3:1 or more against its surroundings", async ({ page }) => {
    await openKit(page);
    const failures: string[] = [];
    let inside = 0;
    for (let press = 0; press < 250; press += 1) {
      await page.keyboard.press("Tab");
      const probe = await probeFocused(page);
      if (!probe) {
        if (inside > 0) break;
        continue;
      }
      inside += 1;
      const ratio = probe.ring ? contrastRatio(probe.ring, probe.background) : 0;
      if (probe.style === "none" || probe.width < 3 || ratio < 3) {
        failures.push(`${probe.name}: ${probe.style} ${probe.width}px ${probe.ring} on ${probe.background} = ${ratio.toFixed(2)}`);
      }
    }
    expect(inside).toBeGreaterThanOrEqual(5);
    expect(failures).toEqual([]);
  });

  test("primitives never create live regions", async ({ page }) => {
    await openKit(page);
    await expect(page.locator('main[data-ui-kit] :is([aria-live], [role="status"], [role="alert"], output)')).toHaveCount(0);
  });
});

test.describe("Button and ButtonLink", () => {
  test("render the button slot with variant hooks and 44/52px targets", async ({ page }) => {
    await openKit(page);
    const primary = page.locator('[data-demo="button-primary"] [data-slot="button"]');
    await expect(primary).toHaveAttribute("data-variant", "primary");
    await expect(primary).toHaveAttribute("data-size", "lg");
    await expect(primary).toHaveAttribute("type", "button");
    expect((await primary.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(52);
    for (const demo of ["button-secondary", "button-text", "button-link-internal"]) {
      const element = page.locator(`[data-demo="${demo}"] [data-slot="button"]`);
      expect((await element.boundingBox())?.height ?? 0, demo).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator('[data-demo="button-secondary"] [data-slot="button"]')).toHaveAttribute("data-variant", "secondary");
    await expect(page.locator('[data-demo="button-text"] [data-slot="button"]')).toHaveAttribute("data-variant", "text");
  });

  test("busy keeps the button enabled and sets aria-busy", async ({ page }) => {
    await openKit(page);
    const busy = page.locator('[data-demo="button-busy"] button');
    await expect(busy).toHaveAttribute("aria-busy", "true");
    await expect(busy).toBeEnabled();
    await expect(busy).toHaveText("조회 중…");
  });

  test("an internal ButtonLink stays in the tab and keeps its visible name", async ({ page }) => {
    await openKit(page);
    const link = page.locator('[data-demo="button-link-internal"] a');
    await expect(link).not.toHaveAttribute("target");
    await expect(link).not.toHaveAttribute("aria-label");
    await expect(link).not.toHaveAttribute("rel");
    await expect(link).toHaveAccessibleName("개인정보처리방침");
  });
});

test.describe("ToneIcon, StatusChip and the status-head field", () => {
  test("one chip per tone, each with an aria-hidden icon and its text", async ({ page }) => {
    await openKit(page);
    const chips = page.locator('[data-demo="chips"] [data-status-chip]');
    await expect(chips).toHaveCount(6);
    const tones = await chips.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-tone")));
    expect(tones).toEqual(["neutral", "progress", "waiting", "attention", "problem", "done"]);
    for (const chip of await chips.all()) {
      await expect(chip).toHaveAttribute("data-status-chip", "true");
      await expect(chip.locator('svg[aria-hidden="true"]')).toHaveCount(1);
      await expect(chip).not.toHaveText("");
    }
  });

  test("inside a field the chip is reversed and secondary/text buttons take the field's text color", async ({ page }) => {
    await openKit(page);
    for (const tone of ["neutral", "progress", "waiting", "attention", "problem", "done"]) {
      const colors = await page.locator(`[data-demo="field-${tone}"]`).evaluate((field) => {
        const read = (selector: string) => {
          const node = field.querySelector(selector);
          return node ? getComputedStyle(node) : null;
        };
        const chip = read("[data-status-chip]");
        const secondary = read('[data-slot="button"][data-variant="secondary"]');
        const text = read('[data-slot="button"][data-variant="text"]');
        return {
          fieldBg: getComputedStyle(field).backgroundColor,
          fieldFg: getComputedStyle(field).color,
          chipBg: chip?.backgroundColor,
          chipFg: chip?.color,
          secondaryBorder: secondary?.borderTopColor,
          secondaryFg: secondary?.color,
          secondaryBg: secondary?.backgroundColor,
          textFg: text?.color
        };
      });
      expect(colors.fieldBg, tone).not.toBe("rgba(0, 0, 0, 0)");
      expect(colors.chipBg, tone).toBe(colors.fieldFg);
      expect(colors.chipFg, tone).toBe(colors.fieldBg);
      expect(colors.secondaryBorder, tone).toBe(colors.fieldFg);
      expect(colors.secondaryFg, tone).toBe(colors.fieldFg);
      expect(colors.secondaryBg, tone).toBe("rgba(0, 0, 0, 0)");
      expect(colors.textFg, tone).toBe(colors.fieldFg);
    }
  });

  test("forced colors: chips keep a visible border", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openKit(page);
    const width = await page
      .locator('[data-demo="chips"] [data-status-chip]')
      .first()
      .evaluate((element) => getComputedStyle(element).borderTopWidth);
    expect(Number.parseFloat(width)).toBeGreaterThanOrEqual(1);
  });
});
