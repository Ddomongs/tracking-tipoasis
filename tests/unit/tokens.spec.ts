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
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import tailwindConfig from "@/tailwind.config";
import { disclosures } from "@/config/site.config";

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
const REPO_ROOT = path.resolve(__dirname, "../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function declarations(block: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of block.matchAll(/(--tt-[a-z0-9-]+)\s*:\s*([^;]+);/g)) map.set(match[1], match[2].trim());
  return map;
}

function signalBlock(css: string): Map<string, string> {
  const match = css.match(/:root,\s*\[data-style="signal"\]\s*\{([^}]*)\}/);
  if (!match) throw new Error('app/styles/tokens.css has no ":root, [data-style=\\"signal\\"]" block');
  return declarations(match[1]);
}

function pixels(value: string | undefined): number {
  if (!value || !/^\d+(\.\d+)?px$/.test(value)) throw new Error(`expected a px value, got "${value}"`);
  return Number.parseFloat(value);
}

function milliseconds(value: string | undefined): number {
  if (!value || !/^\d+ms$/.test(value)) throw new Error(`expected a ms value, got "${value}"`);
  return Number.parseFloat(value);
}

test.describe("tokens.css (signal)", () => {
  test("declares every contract token with the TypeScript color values and nothing else", () => {
    const block = signalBlock(readRepoFile("app/styles/tokens.css"));
    const signal = signalColors();
    for (const token of COLOR_TOKENS) expect(block.get(token)?.toUpperCase(), token).toBe(signal[token]);
    for (const token of NON_COLOR_TOKENS) expect(block.has(token), token).toBe(true);
    const known = new Set<string>([...COLOR_TOKENS, ...NON_COLOR_TOKENS]);
    expect([...block.keys()].filter((name) => !known.has(name))).toEqual([]);
  });

  test("non-color signal values follow the spec's type, focus, motion and layout budgets", () => {
    const block = signalBlock(readRepoFile("app/styles/tokens.css"));
    expect(["--tt-text-xs", "--tt-text-sm", "--tt-text-md", "--tt-text-lg", "--tt-text-xl"].map((t) => pixels(block.get(t)))).toEqual([
      12, 14, 16, 20, 24
    ]);
    const eta = pixels(block.get("--tt-text-eta"));
    expect(eta).toBeGreaterThanOrEqual(32);
    expect(eta).toBeLessThanOrEqual(40);
    expect(pixels(block.get("--tt-focus-width"))).toBeGreaterThanOrEqual(3);
    expect(pixels(block.get("--tt-focus-offset"))).toBe(2);
    for (const token of ["--tt-motion-fast", "--tt-motion-base", "--tt-motion-slow"]) {
      const ms = milliseconds(block.get(token));
      expect(ms, token).toBeGreaterThanOrEqual(150);
      expect(ms, token).toBeLessThanOrEqual(300);
    }
    expect(pixels(block.get("--tt-header-h"))).toBe(48);
    expect(pixels(block.get("--tt-column"))).toBe(560);
    expect(pixels(block.get("--tt-side"))).toBe(320);
    expect(pixels(block.get("--tt-status-field-max"))).toBe(300);
    expect(pixels(block.get("--tt-anchor-reserve"))).toBe(64);
    expect(pixels(block.get("--tt-radius-button"))).toBe(0);
    expect(pixels(block.get("--tt-border-button"))).toBe(2);
    expect(block.get("--tt-font-mono")).toContain("var(--font-dm-mono");
    expect(block.get("--tt-font-body")).not.toMatch(/IBM Plex|Space Grotesk/);
  });

  test("reduced motion sets every motion token to 0ms with a selector style files cannot outrank", () => {
    const css = readRepoFile("app/styles/tokens.css");
    const match = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root,\s*\[data-style\]\[data-style\]\s*\{([^}]*)\}/);
    expect(match, "reduced-motion block").not.toBeNull();
    const block = declarations(match ? match[1] : "");
    expect(block.get("--tt-motion-fast")).toBe("0ms");
    expect(block.get("--tt-motion-base")).toBe("0ms");
    expect(block.get("--tt-motion-slow")).toBe("0ms");
  });
});
test.describe("tailwind mapping", () => {
  const extend = (tailwindConfig.theme?.extend ?? {}) as Readonly<Record<string, unknown>>;

  test("colors.tt maps every color token and no legacy color key remains", () => {
    const colors = extend.colors as Readonly<Record<string, Readonly<Record<string, string>>>>;
    expect(Object.keys(colors)).toEqual(["tt"]);
    expect(Object.keys(colors.tt)).toEqual([
      "ground", "surface", "raised", "ink", "muted", "rule", "control", "route", "primary", "on-primary", "accent", "link",
      "focus", "tile", "board", "progress", "progress-on", "progress-ink", "waiting", "waiting-on", "waiting-ink",
      "attention", "attention-on", "attention-ink", "problem", "problem-on", "problem-ink", "done", "done-on", "done-ink"
    ]);
    expect(colors.tt.ground).toBe("var(--tt-ground)");
    expect(colors.tt["on-primary"]).toBe("var(--tt-on-primary)");
    expect(colors.tt["attention-ink"]).toBe("var(--tt-tone-attention-ink)");
    expect(Object.values(colors.tt).map((value) => value.slice(4, -1)).sort()).toEqual([...COLOR_TOKENS].sort());
  });

  test("font, size, radius, duration and easing keys point at tokens", () => {
    expect(extend.fontFamily).toEqual({
      "tt-body": "var(--tt-font-body)",
      "tt-display": "var(--tt-font-display)",
      "tt-mono": "var(--tt-font-mono)"
    });
    expect(extend.fontSize).toEqual({
      "tt-xs": ["var(--tt-text-xs)", { lineHeight: "18px" }],
      "tt-sm": ["var(--tt-text-sm)", { lineHeight: "20px" }],
      "tt-md": ["var(--tt-text-md)", { lineHeight: "24px" }],
      "tt-lg": ["var(--tt-text-lg)", { lineHeight: "28px" }],
      "tt-xl": ["var(--tt-text-xl)", { lineHeight: "32px" }],
      "tt-eta": ["var(--tt-text-eta)", { lineHeight: "1.1" }]
    });
    expect(extend.borderRadius).toMatchObject({ "tt-button": "var(--tt-radius-button)", "tt-card": "var(--tt-radius-card)" });
    expect(extend.transitionDuration).toEqual({
      "tt-fast": "var(--tt-motion-fast)",
      "tt-base": "var(--tt-motion-base)",
      "tt-slow": "var(--tt-motion-slow)"
    });
    expect(extend.transitionTimingFunction).toEqual({ tt: "var(--tt-ease)" });
  });
});

test.describe("DESIGN.md is the single source", () => {
  const design = (): string => readRepoFile("DESIGN.md");

  test("lists every signal color token with its value", () => {
    const text = design();
    const signal = signalColors();
    const missing = COLOR_TOKENS.filter((token) => !new RegExp(`\\|\\s*\`${token}\`\\s*\\|\\s*\`${signal[token]}\`\\s*\\|`).test(text));
    expect(missing).toEqual([]);
  });

  test("names every non-color token, variant slot, S05 hook and the two motions", () => {
    const text = design();
    const names = [
      ...NON_COLOR_TOKENS,
      'data-slot="status-head"',
      'data-slot="eta"',
      'data-slot="journey"',
      'data-slot="button"',
      "data-tone",
      "data-status-chip",
      "data-station",
      "data-station-state",
      "data-issue",
      "data-spine-current",
      "data-eta-kind",
      "data-number-bar",
      "data-affiliate-group",
      "data-affiliate-disclosure",
      "data-link-placement",
      "data-notice-kind",
      "tt-paint",
      "tt-grow"
    ];
    expect(names.filter((name) => !text.includes(`\`${name}\``))).toEqual([]);
  });

  test("its contrast table matches the computed ratios", () => {
    const text = design();
    const signal = signalColors();
    const wrong = CONTRAST_REQUIREMENTS.filter(({ fg, bg, min }) => {
      const ratio = contrastRatio(signal[fg], signal[bg]).toFixed(2);
      return !text.includes(`| \`${fg}\` / \`${bg}\` | ${ratio}:1 | ${min}:1 |`);
    }).map(({ fg, bg }) => `${fg} / ${bg}`);
    expect(wrong).toEqual([]);
  });

  test("documents every primitive and the configured disclosure wording", () => {
    const text = design();
    const primitives = [
      "Button", "ButtonLink", "ToneIcon", "StatusChip", "JourneySpine", "EtaDisplay",
      "NumberBar", "CopyButton", "AffiliateLinkGroup", "NoticeBanner", "TalkLink", "LiveAnnouncer"
    ];
    expect(primitives.filter((name) => !text.includes(`\`${name}\``))).toEqual([]);
    expect(text).toContain(disclosures.coupang);
  });

  test("carries no legacy tokens or fonts", () => {
    const text = design();
    const legacy = ["background-base", "accent-info", "accent-action", "surface-luminous", "IBM Plex", "Space Grotesk", "4.8s loop"];
    expect(legacy.filter((word) => text.includes(word))).toEqual([]);
  });
});

test.describe("design-system bundle", () => {
  const DS_FILES = [
    "README.md",
    "_base.css",
    "components/buttons.html",
    "components/cards.html",
    "components/customer-cta.html",
    "components/journey-spine.html",
    "components/status.html",
    "components/tracking-form.html",
    "foundations/colors.html",
    "foundations/spacing.html",
    "foundations/typography.html"
  ] as const;
  const HTML_FILES = DS_FILES.filter((file) => file.endsWith(".html"));
  const normalize = (text: string): string => text.replace(/\r\n/g, "\n");

  function listFiles(directory: string, prefix = ""): string[] {
    return readdirSync(path.join(REPO_ROOT, directory), { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? listFiles(path.join(directory, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]
    );
  }

  test("contains exactly the listed files and the README names every preview", () => {
    expect(listFiles("design-system").sort()).toEqual([...DS_FILES].sort());
    const readme = readRepoFile("design-system/README.md");
    expect(HTML_FILES.filter((file) => !readme.includes(file))).toEqual([]);
  });

  test("_base.css embeds app/styles/tokens.css unchanged", () => {
    const base = normalize(readRepoFile("design-system/_base.css"));
    expect(base.startsWith('@import url("https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&display=swap");')).toBe(true);
    expect(base).toContain(normalize(readRepoFile("app/styles/tokens.css")).trim());
  });

  test("previews use tokens only: card marker, base stylesheet, no color literals, no legacy fonts or effects", () => {
    const problems: string[] = [];
    for (const file of HTML_FILES) {
      const html = readRepoFile(`design-system/${file}`);
      if (!/^<!-- @dsCard group="(Foundations|Components)"/.test(html)) problems.push(`${file}: no @dsCard marker`);
      if (!html.includes('<link rel="stylesheet" href="../_base.css">')) problems.push(`${file}: no ../_base.css`);
      if (/#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?\b/.test(html)) problems.push(`${file}: color literal`);
      if (/(?:rgb|hsl)a?\(/.test(html)) problems.push(`${file}: color function`);
    }
    for (const file of DS_FILES) {
      const text = readRepoFile(`design-system/${file}`);
      for (const legacy of ["IBM Plex", "Space Grotesk", "linear-gradient", "radial-gradient", "backdrop-filter", "blur(", "box-shadow"]) {
        if (text.includes(legacy)) problems.push(`${file}: ${legacy}`);
      }
    }
    expect(problems).toEqual([]);
  });

  test("every located spine preview marks exactly one current station", () => {
    let lists = 0;
    let unknown = 0;
    let current = 0;
    for (const file of HTML_FILES) {
      const html = readRepoFile(`design-system/${file}`);
      lists += (html.match(/<ol aria-label="배송 여정 4구간"/g) ?? []).length;
      unknown += (html.match(/data-spine-current="none"/g) ?? []).length;
      current += (html.match(/aria-current="step"/g) ?? []).length;
    }
    expect(lists).toBeGreaterThanOrEqual(8);
    expect(unknown).toBeGreaterThanOrEqual(1);
    expect(current).toBe(lists - unknown);
  });

  test("store previews put the configured disclosure first", () => {
    let groups = 0;
    for (const file of HTML_FILES) {
      const html = readRepoFile(`design-system/${file}`);
      const pattern = /<(?:div|section) data-(?:affiliate-group|shortcut-row)="[^"]*"[^>]*>\s*(<p data-affiliate-disclosure="coupang">([^<]*)<\/p>)?/g;
      for (const match of html.matchAll(pattern)) {
        groups += 1;
        expect(match[1], `${file}: the disclosure must be the first child`).toBeDefined();
        expect(match[2], file).toBe(disclosures.coupang);
      }
    }
    expect(groups).toBeGreaterThanOrEqual(3);
  });
});
