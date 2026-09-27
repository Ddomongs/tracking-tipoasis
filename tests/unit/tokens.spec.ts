import { expect, test } from "@playwright/test";
import {
  DARK_STYLE_ID,
  DEFAULT_STYLE_ID,
  IMPLEMENTED_STYLE_IDS,
  STYLE_IDS,
  STYLE_LABELS,
  STYLE_STORAGE_KEY,
  isStyleId
} from "@/lib/style/styles";
import {
  COLOR_TOKENS,
  CONTRAST_REQUIREMENTS,
  NON_COLOR_TOKENS,
  STYLE_COLOR_TOKENS,
  contrastRatio,
  type ColorTokenSet
} from "@/lib/style/tokens";

const HEX_COLOR = /^#[0-9A-F]{6}$/;
const TONES = ["progress", "waiting", "attention", "problem", "done"] as const;

function implementedColorSets(): ReadonlyArray<readonly [string, ColorTokenSet]> {
  return IMPLEMENTED_STYLE_IDS.map((id) => {
    const set = STYLE_COLOR_TOKENS[id];
    if (!set) throw new Error(`style "${id}" is implemented but has no color tokens`);
    return [id, set] as const;
  });
}

function signalColors(): ColorTokenSet {
  const set = STYLE_COLOR_TOKENS.signal;
  if (!set) throw new Error("signal color tokens are missing");
  return set;
}

function hsl(hex: string): { readonly hue: number; readonly saturation: number; readonly lightness: number } {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { hue: 0, saturation: 0, lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  return { hue: hue < 0 ? hue + 360 : hue, saturation, lightness };
}

function isRed(hex: string): boolean {
  const { hue, saturation, lightness } = hsl(hex);
  return saturation >= 0.35 && lightness > 0.15 && lightness < 0.85 && (hue <= 15 || hue >= 345);
}

test.describe("style ids", () => {
  test("lists the three styles with customer labels and signal as the default", () => {
    expect(STYLE_IDS).toEqual(["signal", "manifest", "night"]);
    expect(STYLE_LABELS).toEqual({ signal: "기본", manifest: "서류형", night: "어두운 화면" });
    expect(DEFAULT_STYLE_ID).toBe("signal");
    expect(DARK_STYLE_ID).toBe("night");
    expect(STYLE_STORAGE_KEY).toBe("tt:style");
  });

  test("implements only signal in S05", () => {
    expect(IMPLEMENTED_STYLE_IDS).toEqual(["signal"]);
  });

  test("isStyleId accepts exactly the three ids", () => {
    for (const id of STYLE_IDS) expect(isStyleId(id)).toBe(true);
    for (const value of ["", "Signal", "dark", "tt:style", null, undefined, 1, {}]) expect(isStyleId(value)).toBe(false);
  });
});

test.describe("color tokens", () => {
  test("names the 30 color tokens and 27 non-color tokens of the contract once each", () => {
    expect(COLOR_TOKENS).toHaveLength(30);
    expect(new Set(COLOR_TOKENS).size).toBe(30);
    expect(NON_COLOR_TOKENS).toHaveLength(27);
    expect(new Set(NON_COLOR_TOKENS).size).toBe(27);
  });

  test("every implemented style defines every color token as #RRGGBB", () => {
    for (const [id, set] of implementedColorSets()) {
      expect(Object.keys(set).sort(), id).toEqual([...COLOR_TOKENS].sort());
      for (const token of COLOR_TOKENS) expect(set[token], `${id} ${token}`).toMatch(HEX_COLOR);
    }
  });

  test("the contrast requirement list is exactly the contract's", () => {
    const expected = [
      "--tt-ink|--tt-surface|4.5",
      "--tt-ink|--tt-ground|4.5",
      "--tt-muted|--tt-surface|4.5",
      "--tt-muted|--tt-ground|4.5",
      "--tt-link|--tt-surface|4.5",
      "--tt-link|--tt-ground|4.5",
      "--tt-on-primary|--tt-primary|4.5",
      "--tt-board|--tt-tile|4.5",
      "--tt-control|--tt-surface|3",
      "--tt-route|--tt-surface|3",
      "--tt-focus|--tt-surface|3",
      "--tt-focus|--tt-ground|3",
      ...TONES.flatMap((tone) => [`--tt-tone-${tone}-on|--tt-tone-${tone}|4.5`, `--tt-tone-${tone}-ink|--tt-surface|4.5`])
    ];
    const actual = CONTRAST_REQUIREMENTS.map(({ fg, bg, min }) => `${fg}|${bg}|${min}`);
    expect([...actual].sort()).toEqual([...expected].sort());
  });

  test("every implemented style meets every contrast requirement", () => {
    const failures: string[] = [];
    for (const [id, set] of implementedColorSets()) {
      for (const { fg, bg, min } of CONTRAST_REQUIREMENTS) {
        const ratio = contrastRatio(set[fg], set[bg]);
        if (ratio < min) failures.push(`${id}: ${fg} on ${bg} = ${ratio.toFixed(2)} < ${min}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("contrastRatio follows the WCAG 2.x formula", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
    expect(contrastRatio("#2244D1", "#FFFFFF")).toBeCloseTo(7.46, 1);
    expect(() => contrastRatio("#FFF", "#000000")).toThrow("#RRGGBB");
  });
});

test.describe("signal supplements (spec §13)", () => {
  test("'확인 필요' is an amber field with ink text", () => {
    const signal = signalColors();
    expect(signal["--tt-tone-attention-on"]).toBe(signal["--tt-ink"]);
    const { hue } = hsl(signal["--tt-tone-attention"]);
    expect(hue).toBeGreaterThanOrEqual(35);
    expect(hue).toBeLessThanOrEqual(55);
  });

  test("red is used only for '문제'", () => {
    const signal = signalColors();
    const redTokens = COLOR_TOKENS.filter((token) => isRed(signal[token]));
    expect(redTokens).toEqual(["--tt-tone-problem", "--tt-tone-problem-ink"]);
  });

  test("the link color is separate from the '정상 진행' tone and the accent", () => {
    const signal = signalColors();
    expect(signal["--tt-link"]).not.toBe(signal["--tt-tone-progress"]);
    expect(signal["--tt-link"]).not.toBe(signal["--tt-accent"]);
  });

  test("the five tone fills are distinct colors", () => {
    const signal = signalColors();
    const fills = TONES.map((tone) => signal[`--tt-tone-${tone}`]);
    expect(new Set(fills).size).toBe(5);
  });
});
