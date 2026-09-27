import { expect, test, type Page } from "@playwright/test";
import { STYLE_COLOR_TOKENS, contrastRatio } from "@/lib/style/tokens";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import { FAKE, FAKE_GROUPED } from "../fixtures/tracking-fixtures";
import { channels, disclosures } from "@/config/site.config";
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
  await settleAnimations(page);
}

/** Waits for the one-shot entrance motion (spine grow, field paint) so colors and boxes are final. */
async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => animation)));
  });
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

const STATION_IDS = ["departed", "customs", "domestic", "arrived"] as const;
const STATION_NAMES = ["해외 출발", "입항·통관", "국내 배송", "도착"] as const;

interface SpineSnapshot {
  readonly current: string | null;
  readonly stations: ReadonlyArray<{
    readonly id: string | null;
    readonly state: string | null;
    readonly issue: string | null;
    readonly currentStep: boolean;
    readonly text: string;
  }>;
  readonly unknownText: string | null;
}

async function readSpine(page: Page, demo: string): Promise<SpineSnapshot> {
  return page.locator(`[data-demo="${demo}"] [data-slot="journey"]`).evaluate((root) => ({
    current: root.querySelector("ol")?.getAttribute("data-spine-current") ?? null,
    stations: Array.from(root.querySelectorAll("ol > li"), (item) => ({
      id: item.getAttribute("data-station"),
      state: item.getAttribute("data-station-state"),
      issue: item.getAttribute("data-issue"),
      currentStep: item.getAttribute("aria-current") === "step",
      text: (item.textContent ?? "").replace(/\s+/g, " ").trim()
    })),
    unknownText: root.querySelector('[data-spine-part="unknown"]')?.textContent ?? null
  }));
}

test.describe("JourneySpine", () => {
  test("every spine is one labelled ol of the four stations in order", async ({ page }) => {
    await openKit(page);
    const lists = page.locator('main[data-ui-kit] [data-slot="journey"] > ol');
    const count = await lists.count();
    expect(count).toBeGreaterThanOrEqual(11);
    for (let index = 0; index < count; index += 1) {
      const list = lists.nth(index);
      await expect(list).toHaveAttribute("aria-label", "배송 여정 4구간");
      const ids = await list.locator(":scope > li").evaluateAll((items) => items.map((item) => item.getAttribute("data-station")));
      expect(ids).toEqual([...STATION_IDS]);
    }
  });

  test("exactly one aria-current=step on a located spine and none before the location is known", async ({ page }) => {
    await openKit(page);
    let located = 0;
    for (const list of await page.locator('main[data-ui-kit] [data-slot="journey"] > ol').all()) {
      const current = await list.getAttribute("data-spine-current");
      const marked = list.locator(':scope > li[aria-current="step"]');
      if (current === "none") {
        await expect(marked).toHaveCount(0);
        continue;
      }
      located += 1;
      await expect(marked).toHaveCount(1);
      await expect(marked).toHaveAttribute("data-station", current ?? "");
      await expect(marked).toHaveAttribute("data-station-state", "current");
    }
    expect(located).toBeGreaterThanOrEqual(10);
    await expect(page.locator('main[data-ui-kit] [aria-current="step"]')).toHaveCount(located);
  });

  test("stations before the current one are done and the rest are todo", async ({ page }) => {
    await openKit(page);
    const expected: Readonly<Record<string, readonly string[]>> = {
      "spine-customs": ["done", "current", "todo", "todo"],
      "spine-domestic": ["done", "done", "current", "todo"],
      "spine-arrived": ["done", "done", "done", "current"],
      "spine-unknown": ["todo", "todo", "todo", "todo"]
    };
    for (const [demo, states] of Object.entries(expected)) {
      const spine = await readSpine(page, demo);
      expect(spine.stations.map((station) => station.state), demo).toEqual(states);
      expect(spine.stations.map((station) => station.text), demo).toEqual([...STATION_NAMES]);
    }
  });

  test("unknown location: no marker, every station todo and the words '위치 확인 전'", async ({ page }) => {
    await openKit(page);
    const spine = await readSpine(page, "spine-unknown");
    expect(spine.current).toBe("none");
    expect(spine.stations.filter((station) => station.currentStep)).toEqual([]);
    expect(spine.unknownText).toBe("위치 확인 전");
    await expect(page.locator('[data-demo="spine-unknown"] [data-spine-part="unknown"]')).toBeVisible();
  });

  test("issue marks combine color, an icon and the word", async ({ page }) => {
    await openKit(page);
    for (const [demo, station, kind, word] of [
      ["spine-stopped", "customs", "stopped", "멈춤"],
      ["spine-cut", "domestic", "cut", "끊김"],
      ["spine-branch", "domestic", "branch", "갈림"],
      ["spine-cut-ahead", "domestic", "cut", "끊김"]
    ] as const) {
      const item = page.locator(`[data-demo="${demo}"] li[data-station="${station}"]`);
      await expect(item, demo).toHaveAttribute("data-issue", kind);
      await expect(item.locator('[data-spine-part="issue"]'), demo).toHaveText(word);
      await expect(item.locator(`svg[data-tone-icon="${kind}"][aria-hidden="true"]`), demo).toHaveCount(1);
      const bar = await item.locator('[data-spine-part="bar"]').evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        background: getComputedStyle(element).backgroundColor
      }));
      expect(bar.height, demo).toBe(20);
      expect(bar.background, demo).not.toBe("rgba(0, 0, 0, 0)");
    }
    // A carrier delay while customs is still current marks ③ and keeps ② as the current station.
    await expect(page.locator('[data-demo="spine-cut-ahead"] li[data-station="domestic"]')).toHaveAttribute("data-station-state", "todo");
    await expect(page.locator('[data-demo="spine-cut-ahead"] li[aria-current="step"]')).toHaveAttribute("data-station", "customs");
  });

  test("code 4 keeps ② current with a check mark and '인계 대기'", async ({ page }) => {
    await openKit(page);
    const current = page.locator('[data-demo="spine-handoff"] li[aria-current="step"]');
    await expect(current).toHaveAttribute("data-station", "customs");
    await expect(current.locator('[data-spine-part="sub"]')).toHaveText("인계 대기");
    await expect(current.locator('svg[data-tone-icon="done"]')).toHaveCount(1);
  });

  test("inside a field every bar uses the field's text color", async ({ page }) => {
    await openKit(page);
    const colors = await page.locator('[data-demo="spine-customs"]').evaluate((field) => {
      const bar = (station: string) => {
        const element = field.querySelector(`li[data-station="${station}"] [data-spine-part="bar"]`);
        return element ? getComputedStyle(element) : null;
      };
      return {
        fieldFg: getComputedStyle(field).color,
        done: bar("departed")?.backgroundColor,
        current: bar("customs")?.backgroundColor,
        todoBorder: bar("domestic")?.borderTopColor,
        todoWidth: bar("domestic")?.borderTopWidth
      };
    });
    expect(colors.done).toBe(colors.fieldFg);
    expect(colors.current).toBe(colors.fieldFg);
    expect(colors.todoBorder).toBe(colors.fieldFg);
    expect(colors.todoWidth).toBe("2px");
  });

  test("forced colors: done and current bars keep a CanvasText fill", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openKit(page);
    const result = await page.locator('[data-demo="spine-customs"]').evaluate((field) => {
      const probe = document.createElement("div");
      probe.style.forcedColorAdjust = "none";
      probe.style.backgroundColor = "CanvasText";
      document.body.append(probe);
      const canvasText = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const background = (station: string) => {
        const element = field.querySelector(`li[data-station="${station}"] [data-spine-part="bar"]`);
        return element ? getComputedStyle(element).backgroundColor : "missing";
      };
      return { canvasText, done: background("departed"), current: background("customs") };
    });
    expect(result.done).toBe(result.canvasText);
    expect(result.current).toBe(result.canvasText);
  });
});

test.describe("EtaDisplay", () => {
  const DATE_DEMOS = ["eta-date", "eta-today", "eta-holiday", "eta-overdue", "eta-delivered"] as const;
  const TEXT_DEMOS = ["eta-pending", "eta-withheld", "eta-unknown"] as const;

  test("renders one eta slot per kind and nothing for 'none'", async ({ page }) => {
    await openKit(page);
    const kinds: Readonly<Record<string, string>> = {
      "eta-date": "date",
      "eta-today": "today",
      "eta-holiday": "holidayAffected",
      "eta-overdue": "overdue",
      "eta-delivered": "deliveredOn",
      "eta-pending": "pendingInfo",
      "eta-withheld": "withheld",
      "eta-unknown": "unknown"
    };
    for (const [demo, kind] of Object.entries(kinds)) {
      await expect(page.locator(`[data-demo="${demo}"] [data-slot="eta"]`), demo).toHaveAttribute("data-eta-kind", kind);
    }
    await expect(page.locator('[data-demo="eta-none"]')).toBeAttached();
    await expect(page.locator('[data-demo="eta-none"] *')).toHaveCount(0);
  });

  test("dates are read once from a screen-reader label and drawn from aria-hidden digit parts", async ({ page }) => {
    await openKit(page);
    for (const demo of DATE_DEMOS) {
      const parts = await page.locator(`[data-demo="${demo}"] [data-eta-value]`).evaluate((element) => {
        const visual = element.querySelector("[data-eta-visual]");
        return {
          label: element.querySelector(".sr-only")?.textContent ?? "",
          srOnlyCount: element.querySelectorAll(".sr-only").length,
          hidden: visual?.getAttribute("aria-hidden") ?? null,
          visualText: (visual?.textContent ?? "").replace(/\s+/g, " ").trim(),
          partNames: Array.from(visual?.querySelectorAll("[data-eta-part]") ?? [], (part) => part.getAttribute("data-eta-part")),
          digits: Array.from(visual?.querySelectorAll("[data-eta-digit]") ?? [], (digit) => [digit.getAttribute("data-eta-digit"), digit.textContent])
        };
      });
      expect(parts.srOnlyCount, demo).toBe(1);
      expect(parts.hidden, demo).toBe("true");
      expect(parts.visualText, demo).toBe(parts.label);
      expect(parts.partNames, demo).toEqual(["month", "day", "weekday"]);
      expect(parts.digits.length, demo).toBe(parts.label.replace(/\D/g, "").length);
      for (const [attribute, text] of parts.digits) expect(attribute, demo).toBe(text);
    }
    await expect(page.locator('[data-demo="eta-date"] [data-eta-value] .sr-only')).toHaveText("9월 30일 (수)");
  });

  test("D-n shows only for a plain estimate; the holiday badge replaces it", async ({ page }) => {
    await openKit(page);
    const dday = page.locator('[data-demo="eta-date"] [data-eta-dday]');
    await expect(dday).toHaveText("D-4");
    await expect(dday).toHaveAttribute("data-eta-dday", "4");
    for (const demo of ["eta-today", "eta-holiday", "eta-overdue", "eta-delivered", ...TEXT_DEMOS]) {
      await expect(page.locator(`[data-demo="${demo}"] [data-eta-dday]`), demo).toHaveCount(0);
    }
    const badge = page.locator('[data-demo="eta-holiday"] [data-eta-badge]');
    await expect(badge).toHaveText("추석 연휴 영향 · 1~2일 늦어질 수 있어요");
    await expect(badge.locator('svg[aria-hidden="true"]')).toHaveCount(1);
    await expect(page.locator('[data-demo="eta-today"] [data-eta-label]')).toHaveText("오늘 예상");
    await expect(page.locator('[data-demo="eta-holiday"] [data-eta-label]')).not.toHaveText("오늘 예상");
  });

  test("text kinds say what is known instead of a date", async ({ page }) => {
    await openKit(page);
    await expect(page.locator('[data-demo="eta-pending"] [data-eta-text]')).toHaveText("정보 등록 후 안내");
    await expect(page.locator('[data-demo="eta-withheld"] [data-eta-text]')).toHaveText("지금은 도착 예상일을 안내하기 어려워요");
    for (const demo of TEXT_DEMOS) await expect(page.locator(`[data-demo="${demo}"] [data-eta-value]`), demo).toHaveCount(0);
  });

  test("the estimated date is the largest text in the status field (32–40px)", async ({ page }) => {
    await openKit(page, 375, 812);
    const sizes = await page.locator('[data-demo="status-head"]').evaluate((field) => {
      const eta = field.querySelector("[data-eta-visual]");
      const textSizes = Array.from(field.querySelectorAll("*"))
        .filter((element) =>
          Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "")
        )
        .filter((element) => !element.closest(".sr-only"))
        .map((element) => Number.parseFloat(getComputedStyle(element).fontSize));
      return { eta: eta ? Number.parseFloat(getComputedStyle(eta).fontSize) : 0, max: Math.max(...textSizes) };
    });
    expect(sizes.eta).toBeGreaterThanOrEqual(32);
    expect(sizes.eta).toBeLessThanOrEqual(40);
    expect(sizes.max).toBe(sizes.eta);
  });

  test("status field budget: chip, title, reason, spine and date fit --tt-status-field-max at 375×812", async ({ page }) => {
    await openKit(page, 375, 812);
    const height = (await page.locator('[data-demo="status-head"]').boundingBox())?.height ?? Number.POSITIVE_INFINITY;
    const budget = await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tt-status-field-max"))
    );
    // Printed so the stage gate (G8) can record the measured budget.
    console.info(`[budget] status-head field at 375x812: ${Math.round(height)} px (max ${budget} px)`);
    expect(budget).toBe(300);
    expect(height).toBeLessThanOrEqual(budget);
  });

  test("inside a field the D-n chip is reversed and the badge follows the field color", async ({ page }) => {
    await openKit(page);
    const dday = await page.locator('[data-demo="status-head"]').evaluate((field) => {
      const chip = field.querySelector("[data-eta-dday]");
      return {
        fieldBg: getComputedStyle(field).backgroundColor,
        fieldFg: getComputedStyle(field).color,
        chipBg: chip ? getComputedStyle(chip).backgroundColor : null,
        chipFg: chip ? getComputedStyle(chip).color : null
      };
    });
    expect(dday.chipBg).toBe(dday.fieldFg);
    expect(dday.chipFg).toBe(dday.fieldBg);
    const badge = await page.locator('[data-demo="field-eta-holiday"]').evaluate((field) => {
      const element = field.querySelector("[data-eta-badge]");
      return {
        fieldFg: getComputedStyle(field).color,
        border: element ? getComputedStyle(element).borderTopColor : null,
        color: element ? getComputedStyle(element).color : null
      };
    });
    expect(badge.border).toBe(badge.fieldFg);
    expect(badge.color).toBe(badge.fieldFg);
  });
});

// Same value as LONG_HBL in the gallery: a 30-character HBL-shaped fake (letters + zeros only).
const LONG_HBL = `TEST${"0".repeat(26)}`;

test.describe("NumberBar", () => {
  test("shows '조회번호 · carrier' and the number in 4-character monospace groups", async ({ page }) => {
    await openKit(page);
    const bar = page.locator('[data-demo="number-bar-result"] [data-number-bar]');
    await expect(bar).toHaveAttribute("data-number-bar", "true");
    await expect(bar).toContainText("조회번호 · CJ대한통운");
    const value = bar.locator("[data-number-bar-value]");
    await expect(value).toHaveText(FAKE_GROUPED.domestic);
    expect(await value.locator(":scope > span").allTextContents()).toEqual(FAKE_GROUPED.domestic.split(" "));
    const style = await value.evaluate((element) => ({
      family: getComputedStyle(element).fontFamily,
      numeric: getComputedStyle(element).fontVariantNumeric
    }));
    expect(style.family).toMatch(/DM[_ ]Mono/);
    expect(style.numeric).toContain("tabular-nums");
  });

  test("an HBL keeps its letter prefix as one group and a bar without actions has no action row", async ({ page }) => {
    await openKit(page);
    const value = page.locator('[data-demo="number-bar-hbl"] [data-number-bar-value]');
    await expect(value).toHaveText(FAKE_GROUPED.hbl);
    expect(await value.locator(":scope > span").allTextContents()).toEqual(FAKE_GROUPED.hbl.split(" "));
    await expect(page.locator('[data-demo="number-bar-hbl"] [data-number-bar-actions]')).toHaveCount(0);
  });

  test("actions share the number's row on wide screens and move below it at 320px", async ({ page }) => {
    for (const [width, below] of [
      [1280, false],
      [320, true]
    ] as const) {
      await openKit(page, width, 800);
      const boxes = await page.locator('[data-demo="number-bar-result"] [data-number-bar]').evaluate((bar) => ({
        valueBottom: bar.querySelector("[data-number-bar-value]")?.getBoundingClientRect().bottom ?? 0,
        actionsTop: bar.querySelector("[data-number-bar-actions]")?.getBoundingClientRect().top ?? 0
      }));
      if (below) expect(boxes.actionsTop, `${width}px`).toBeGreaterThanOrEqual(boxes.valueBottom);
      else expect(boxes.actionsTop, `${width}px`).toBeLessThan(boxes.valueBottom);
    }
  });

  test("long numbers wrap between groups at 320 px and are never truncated", async ({ page }) => {
    await openKit(page, 320, 800);
    for (const [demo, raw] of [
      ["number-bar-cargo", FAKE.cargo],
      ["number-bar-hbl30", LONG_HBL]
    ] as const) {
      const info = await page.locator(`[data-demo="${demo}"] [data-number-bar-value]`).evaluate((element) => ({
        text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
        groupLines: Array.from(element.querySelectorAll(":scope > span"), (span) => span.getClientRects().length),
        overflow: element.scrollWidth - element.clientWidth,
        textOverflow: getComputedStyle(element).textOverflow,
        height: element.getBoundingClientRect().height,
        lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight)
      }));
      expect(info.text, demo).toBe(groupTrackingNumber(raw));
      expect(info.groupLines.every((lines) => lines === 1), demo).toBe(true);
      expect(info.overflow, demo).toBeLessThanOrEqual(0);
      expect(info.textOverflow, demo).not.toBe("ellipsis");
      if (demo === "number-bar-hbl30") expect(info.height, demo).toBeGreaterThan(info.lineHeight * 1.5);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});

test.describe("TalkLink and AffiliateLinkGroup", () => {
  test("TalkLink opens 톡톡 in a new tab with one look at three weights", async ({ page }) => {
    await openKit(page);
    const talk = channels.talk;
    for (const [demo, variant, placement, label, icons] of [
      ["talk-header", "text", "header", talk.labels.header, 0],
      ["talk-state", "text", "state", talk.labels.cta, 1],
      ["talk-secondary", "secondary", "state", talk.labels.cta, 1],
      ["talk-primary", "primary", "state", talk.labels.cta, 1],
      ["talk-footer", "text", "footer", talk.labels.footer, 1]
    ] as const) {
      const link = page.locator(`[data-demo="${demo}"] a`);
      await expect(link, demo).toHaveAttribute("href", talk.url);
      await expect(link, demo).toHaveAttribute("target", "_blank");
      await expect(link, demo).toHaveAttribute("rel", "noopener noreferrer");
      await expect(link, demo).toHaveAttribute("aria-label", `${label} 새 창으로 열기`);
      await expect(link, demo).toHaveAttribute("data-variant", variant);
      await expect(link, demo).toHaveAttribute("data-link-placement", placement);
      await expect(link.locator('svg[aria-hidden="true"]'), demo).toHaveCount(icons);
      await expect(link, demo).toHaveText(label);
    }
  });

  test("affiliate groups start with the disclosure exactly when a link is affiliate", async ({ page }) => {
    await openKit(page);
    const affiliateHrefs = new Set<string>(Object.values(channels.coupang.urls));
    for (const demo of ["affiliate-pending", "affiliate-delivered", "affiliate-missing-disclosure", "affiliate-naver-only", "field-links"]) {
      const group = page.locator(`[data-demo="${demo}"] [data-affiliate-group]`);
      await expect(group, demo).toHaveCount(1);
      const placement = (await group.getAttribute("data-affiliate-group")) ?? "";
      const links = await group.locator("a").evaluateAll((anchors) =>
        anchors.map((anchor) => ({
          href: anchor.getAttribute("href") ?? "",
          rel: (anchor.getAttribute("rel") ?? "").split(/\s+/).filter(Boolean).sort(),
          target: anchor.getAttribute("target"),
          placement: anchor.getAttribute("data-link-placement"),
          name: anchor.getAttribute("aria-label"),
          text: (anchor.textContent ?? "").trim()
        }))
      );
      expect(links.length, demo).toBeGreaterThan(0);
      const first = await group.evaluate((element) => {
        const child = element.firstElementChild;
        return child ? { tag: child.tagName, disclosure: child.getAttribute("data-affiliate-disclosure"), text: child.textContent } : null;
      });
      if (links.some((link) => affiliateHrefs.has(link.href))) {
        expect(first, demo).toEqual({ tag: "P", disclosure: "coupang", text: disclosures.coupang });
      } else {
        await expect(group.locator("[data-affiliate-disclosure]"), demo).toHaveCount(0);
      }
      for (const link of links) {
        const expectedRel = affiliateHrefs.has(link.href) ? ["nofollow", "noopener", "noreferrer", "sponsored"] : ["noopener", "noreferrer"];
        expect(link.rel, `${demo} ${link.href}`).toEqual(expectedRel);
        expect(link.target, demo).toBe("_blank");
        expect(link.placement, demo).toBe(placement);
        expect(link.name, demo).toBe(`${link.text} 새 창으로 열기`);
      }
    }
  });

  test("placement ids, the purchase-choice intro and an empty group", async ({ page }) => {
    await openKit(page);
    await expect(page.locator('[data-demo="affiliate-pending"] [data-affiliate-group]')).toHaveAttribute("data-affiliate-group", "pending");
    await expect(page.locator('[data-demo="affiliate-delivered"] [data-affiliate-group]')).toHaveAttribute(
      "data-affiliate-group",
      "deliveredLead"
    );
    await expect(page.locator('[data-demo="affiliate-pending"] [data-affiliate-group] > p').nth(1)).toHaveText(
      "주문하신 곳에서도 배송 안내를 볼 수 있어요"
    );
    const lead = page.locator('[data-demo="affiliate-delivered"] a').first();
    await expect(lead).toHaveAttribute("href", channels.naver.urls.deliveredLead);
    await expect(lead).toHaveAttribute("data-variant", "primary");
    await expect(page.locator('[data-demo="affiliate-empty"] *')).toHaveCount(0);
  });

  test("inside a field no text uses the muted color and links take the field color", async ({ page }) => {
    await openKit(page);
    const muted = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "var(--tt-muted)";
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    });
    const fieldColors = await page
      .locator('main[data-ui-kit] [data-slot="status-head"]')
      .evaluateAll((fields) => fields.flatMap((field) => Array.from(field.querySelectorAll("*"), (element) => getComputedStyle(element).color)));
    expect(fieldColors.length).toBeGreaterThan(0);
    expect(fieldColors).not.toContain(muted);
    const result = await page.locator('[data-demo="field-links"]').evaluate((field) => ({
      fieldFg: getComputedStyle(field).color,
      links: Array.from(field.querySelectorAll('a[data-variant="text"], a[data-variant="secondary"]'), (anchor) => getComputedStyle(anchor).color),
      disclosure: getComputedStyle(field.querySelector("[data-affiliate-disclosure]") ?? field).color
    }));
    expect(result.links.length).toBeGreaterThanOrEqual(2);
    for (const color of result.links) expect(color).toBe(result.fieldFg);
    expect(result.disclosure).toBe(result.fieldFg);
  });
});

// The spec's home banner example (spec §7, idle).
const HOME_NOTICE_BODY = "추석 연휴(9/24~26)와 주말에는 통관·택배가 쉬어요. 9월 28일(월)부터 순서대로 진행돼요.";

test.describe("NoticeBanner", () => {
  test("the home banner is an aside named '안내' with the body, at most two lines at 375px, never live", async ({ page }) => {
    await openKit(page, 375, 812);
    const banner = page.locator('[data-demo="notice-banner"] aside');
    await expect(banner).toHaveAttribute("aria-label", "안내");
    await expect(banner).toHaveAttribute("data-notice-kind", "holiday");
    await expect(banner).toHaveAttribute("data-notice-variant", "banner");
    await expect(banner).toHaveText(`안내 ${HOME_NOTICE_BODY}`);
    expect(await banner.getAttribute("aria-live")).toBeNull();
    expect(await banner.getAttribute("role")).toBeNull();
    expect((await banner.boundingBox())?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(56);
  });

  test("the in-card line carries '안내', one icon and the field's text color for every notice kind", async ({ page }) => {
    await openKit(page);
    for (const kind of ["outage", "delay", "holiday", "info"] as const) {
      const field = page.locator(`[data-demo="notice-inline-${kind}"]`);
      const line = field.locator('[data-notice-variant="inline"]');
      await expect(line, kind).toHaveAttribute("data-notice-kind", kind);
      await expect(line.locator("strong"), kind).toHaveText("안내");
      await expect(line.locator('svg[aria-hidden="true"]'), kind).toHaveCount(1);
      const fieldColor = await field.evaluate((element) => getComputedStyle(element).color);
      const lineColor = await line.evaluate((element) => getComputedStyle(element).color);
      expect(lineColor, kind).toBe(fieldColor);
      expect(await line.getAttribute("aria-live"), kind).toBeNull();
    }
  });
});

test.describe("motion", () => {
  test("every animation in the gallery runs once within 150–300 ms", async ({ page }) => {
    await openKit(page);
    const animated = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main[data-ui-kit] *"))
        .map((element) => getComputedStyle(element))
        .filter((style) => style.animationName !== "none")
        .map((style) => ({ name: style.animationName, duration: style.animationDuration, count: style.animationIterationCount }))
    );
    expect(new Set(animated.map((item) => item.name))).toEqual(new Set(["tt-paint", "tt-grow"]));
    for (const item of animated) {
      expect(item.count, item.name).toBe("1");
      const ms = item.duration.endsWith("ms") ? Number.parseFloat(item.duration) : Number.parseFloat(item.duration) * 1000;
      expect(ms, item.name).toBeGreaterThanOrEqual(150);
      expect(ms, item.name).toBeLessThanOrEqual(300);
    }
  });

  test("reduced motion: every animation and transition in the gallery takes 0 ms", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openKit(page);
    const moving = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main[data-ui-kit] *"))
        .map((element) => {
          const style = getComputedStyle(element);
          return `${style.animationDuration},${style.transitionDuration}`;
        })
        .filter((durations) => durations.split(",").some((part) => Number.parseFloat(part) !== 0))
    );
    expect(moving).toEqual([]);
  });
});
