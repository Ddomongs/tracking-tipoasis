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

export const STYLE_COLOR_TOKENS: Readonly<Partial<Record<StyleId, ColorTokenSet>>> = {
  signal: SIGNAL_COLORS
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
