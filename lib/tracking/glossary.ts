import type { GlossaryEntry } from "@/lib/config/types";

const withoutSpaces = (value: string): string => value.replace(/\s+/g, "");

/** '수입신고수리' → { label: '통관 완료', original: '수입신고수리' }; unknown terms pass through. */
export function glossaryLabel(
  status: string,
  glossary: readonly GlossaryEntry[]
): { readonly label: string; readonly original: string | null } {
  const trimmed = status.trim();
  const key = withoutSpaces(trimmed);
  const entry = key.length > 0 ? glossary.find((item) => withoutSpaces(item.source) === key) : undefined;
  if (entry === undefined) return { label: trimmed, original: null };
  return { label: entry.label, original: entry.label === trimmed ? null : trimmed };
}
