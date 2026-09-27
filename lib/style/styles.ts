/**
 * Screen styles the customer can pick (spec §13):
 * "signal" (B 색면 신호, the default), "manifest" (A 세관 서류) and "night" (C 야간 관제) — all three implemented since S08.
 */
export const STYLE_IDS = ["signal", "manifest", "night"] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const DEFAULT_STYLE_ID: StyleId = "signal";
export const DARK_STYLE_ID: StyleId = "night";

/** localStorage key (S08 reads/writes it; never sent to a server). */
export const STYLE_STORAGE_KEY = "tt:style";

export const STYLE_LABELS: Readonly<Record<StyleId, string>> = {
  signal: "기본",
  manifest: "서류형",
  night: "어두운 화면"
};

export const IMPLEMENTED_STYLE_IDS: readonly StyleId[] = ["signal", "manifest", "night"];

export function isStyleId(value: unknown): value is StyleId {
  return typeof value === "string" && (STYLE_IDS as readonly string[]).includes(value);
}
