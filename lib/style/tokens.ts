import type { StyleId } from "./styles";

/** The 30 color custom properties every style defines (roadmap §11.12). */
export const COLOR_TOKENS = [
  "--tt-ground", "--tt-surface", "--tt-raised", "--tt-ink", "--tt-muted", "--tt-rule", "--tt-control", "--tt-route",
  "--tt-primary", "--tt-on-primary", "--tt-accent", "--tt-link", "--tt-focus", "--tt-tile", "--tt-board",
  "--tt-tone-progress", "--tt-tone-progress-on", "--tt-tone-progress-ink",
  "--tt-tone-waiting", "--tt-tone-waiting-on", "--tt-tone-waiting-ink",
  "--tt-tone-attention", "--tt-tone-attention-on", "--tt-tone-attention-ink",
  "--tt-tone-problem", "--tt-tone-problem-on", "--tt-tone-problem-ink",
  "--tt-tone-done", "--tt-tone-done-on", "--tt-tone-done-ink"
] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];
export type ColorTokenSet = Readonly<Record<ColorToken, string>>;

/** The 27 non-color custom properties every style defines (roadmap §11.12, same order). */
export const NON_COLOR_TOKENS = [
  "--tt-font-body", "--tt-font-display", "--tt-font-mono", "--tt-weight-display",
  "--tt-text-xs", "--tt-text-sm", "--tt-text-md", "--tt-text-lg", "--tt-text-xl", "--tt-text-eta",
  "--tt-leading-tight", "--tt-leading-body", "--tt-radius-button", "--tt-radius-card", "--tt-border-button",
  "--tt-focus-width", "--tt-focus-offset", "--tt-motion-fast", "--tt-motion-base", "--tt-motion-slow", "--tt-ease",
  "--tt-gutter", "--tt-header-h", "--tt-column", "--tt-side", "--tt-status-field-max", "--tt-anchor-reserve"
] as const;
export type NonColorToken = (typeof NON_COLOR_TOKENS)[number];

/**
 * Style B "색면 신호" (Phase 3 canvas B, Main.dc.html) plus the §13 supplements:
 * '확인 필요' is amber with ink text, red only for '문제', links are ink + underline
 * (separate from the '정상 진행' blue). Keep in sync with app/styles/tokens.css.
 */
const SIGNAL_COLORS: ColorTokenSet = {
  "--tt-ground": "#EEEDE8",
  "--tt-surface": "#FFFFFF",
  "--tt-raised": "#FFFFFF",
  "--tt-ink": "#111110",
  "--tt-muted": "#5C5B56",
  "--tt-rule": "#D3D2CB",
  "--tt-control": "#767570",
  "--tt-route": "#85847E",
  "--tt-primary": "#111110",
  "--tt-on-primary": "#FFFFFF",
  "--tt-accent": "#2244D1",
  "--tt-link": "#111110",
  "--tt-focus": "#111110",
  "--tt-tile": "#FFFFFF",
  "--tt-board": "#111110",
  "--tt-tone-progress": "#2244D1",
  "--tt-tone-progress-on": "#FFFFFF",
  "--tt-tone-progress-ink": "#2244D1",
  "--tt-tone-waiting": "#CFCEC6",
  "--tt-tone-waiting-on": "#111110",
  "--tt-tone-waiting-ink": "#5C5B56",
  "--tt-tone-attention": "#F4BC00",
  "--tt-tone-attention-on": "#111110",
  "--tt-tone-attention-ink": "#8A5A00",
  "--tt-tone-problem": "#C8261D",
  "--tt-tone-problem-on": "#FFFFFF",
  "--tt-tone-problem-ink": "#C8261D",
  "--tt-tone-done": "#0B6B3E",
  "--tt-tone-done-on": "#FFFFFF",
  "--tt-tone-done-ink": "#0B6B3E"
};

/**
 * Style A "세관 서류" (Phase 3 canvas A, Main.dc.html): cold paper, ink rules, one rubber stamp for the state.
 * Links are ink + underline (apart from the stamp blue). Keep in sync with app/styles/style-manifest.css.
 */
const MANIFEST_COLORS: ColorTokenSet = {
  "--tt-ground": "#ECEFF3",
  "--tt-surface": "#FAFBFC",
  "--tt-raised": "#FAFBFC",
  "--tt-ink": "#14213A",
  "--tt-muted": "#4A566B",
  "--tt-rule": "#C4CCD7",
  "--tt-control": "#6B7689",
  "--tt-route": "#7D8899",
  "--tt-primary": "#1B4A9A",
  "--tt-on-primary": "#FFFFFF",
  "--tt-accent": "#1B4A9A",
  "--tt-link": "#14213A",
  "--tt-focus": "#14213A",
  "--tt-tile": "#FAFBFC",
  "--tt-board": "#14213A",
  "--tt-tone-progress": "#1B4A9A",
  "--tt-tone-progress-on": "#FFFFFF",
  "--tt-tone-progress-ink": "#1B4A9A",
  "--tt-tone-waiting": "#56627A",
  "--tt-tone-waiting-on": "#FFFFFF",
  "--tt-tone-waiting-ink": "#56627A",
  "--tt-tone-attention": "#9A5A00",
  "--tt-tone-attention-on": "#FFFFFF",
  "--tt-tone-attention-ink": "#9A5A00",
  "--tt-tone-problem": "#B3261E",
  "--tt-tone-problem-on": "#FFFFFF",
  "--tt-tone-problem-ink": "#B3261E",
  "--tt-tone-done": "#185C36",
  "--tt-tone-done-on": "#FFFFFF",
  "--tt-tone-done-ink": "#185C36"
};

/**
 * Style C "야간 관제" (Phase 3 canvas C, Main.dc.html): desaturated dark ground, metro-line journey, flat lamps,
 * digit tiles (tile/board). Links are ink + underline (apart from the lamp blue). Keep in sync with app/styles/style-night.css.
 */
const NIGHT_COLORS: ColorTokenSet = {
  "--tt-ground": "#0C1214",
  "--tt-surface": "#131B1E",
  "--tt-raised": "#1A2428",
  "--tt-ink": "#E6ECE9",
  "--tt-muted": "#9AA8AC",
  "--tt-rule": "#27343A",
  "--tt-control": "#62757C",
  "--tt-route": "#6E8288",
  "--tt-primary": "#8FB3F0",
  "--tt-on-primary": "#0C1214",
  "--tt-accent": "#8FB3F0",
  "--tt-link": "#E6ECE9",
  "--tt-focus": "#E6ECE9",
  "--tt-tile": "#080C0E",
  "--tt-board": "#F1E8D4",
  "--tt-tone-progress": "#8FB3F0",
  "--tt-tone-progress-on": "#0C1214",
  "--tt-tone-progress-ink": "#8FB3F0",
  "--tt-tone-waiting": "#A3AFB3",
  "--tt-tone-waiting-on": "#0C1214",
  "--tt-tone-waiting-ink": "#A3AFB3",
  "--tt-tone-attention": "#E8A847",
  "--tt-tone-attention-on": "#0C1214",
  "--tt-tone-attention-ink": "#E8A847",
  "--tt-tone-problem": "#EF7C71",
  "--tt-tone-problem-on": "#0C1214",
  "--tt-tone-problem-ink": "#EF7C71",
  "--tt-tone-done": "#74CB9B",
  "--tt-tone-done-on": "#0C1214",
  "--tt-tone-done-ink": "#74CB9B"
};

export const STYLE_COLOR_TOKENS: Readonly<Partial<Record<StyleId, ColorTokenSet>>> = {
  signal: SIGNAL_COLORS,
  manifest: MANIFEST_COLORS,
  night: NIGHT_COLORS
};

export interface ContrastRequirement {
  readonly fg: ColorToken;
  readonly bg: ColorToken;
  readonly min: 3 | 4.5;
}

/**
 * Checked for every implemented style. The 3:1 focus ring on tone fields uses
 * tone-X-on on tone-X, which the 4.5:1 rows already cover.
 */
export const CONTRAST_REQUIREMENTS: readonly ContrastRequirement[] = [
  { fg: "--tt-ink", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-ink", bg: "--tt-ground", min: 4.5 },
  { fg: "--tt-muted", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-muted", bg: "--tt-ground", min: 4.5 },
  { fg: "--tt-link", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-link", bg: "--tt-ground", min: 4.5 },
  { fg: "--tt-on-primary", bg: "--tt-primary", min: 4.5 },
  { fg: "--tt-tone-progress-on", bg: "--tt-tone-progress", min: 4.5 },
  { fg: "--tt-tone-waiting-on", bg: "--tt-tone-waiting", min: 4.5 },
  { fg: "--tt-tone-attention-on", bg: "--tt-tone-attention", min: 4.5 },
  { fg: "--tt-tone-problem-on", bg: "--tt-tone-problem", min: 4.5 },
  { fg: "--tt-tone-done-on", bg: "--tt-tone-done", min: 4.5 },
  { fg: "--tt-tone-progress-ink", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-tone-waiting-ink", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-tone-attention-ink", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-tone-problem-ink", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-tone-done-ink", bg: "--tt-surface", min: 4.5 },
  { fg: "--tt-board", bg: "--tt-tile", min: 4.5 },
  { fg: "--tt-control", bg: "--tt-surface", min: 3 },
  { fg: "--tt-route", bg: "--tt-surface", min: 3 },
  { fg: "--tt-focus", bg: "--tt-surface", min: 3 },
  { fg: "--tt-focus", bg: "--tt-ground", min: 3 }
];

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function linearChannel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of a #RRGGBB color. */
export function relativeLuminance(hex: string): number {
  if (!HEX_COLOR.test(hex)) throw new Error(`Expected a #RRGGBB color, got "${hex}"`);
  const r = linearChannel(Number.parseInt(hex.slice(1, 3), 16));
  const g = linearChannel(Number.parseInt(hex.slice(3, 5), 16));
  const b = linearChannel(Number.parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio (1–21), independent of argument order. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
