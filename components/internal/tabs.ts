// The CS desk's tabs (spec §10 탭 4개). A plain module (no "use client"): the server page validates ?tab= with it
// and the client desk renders it.

export const INTERNAL_TAB_IDS = ["delivery", "mismatch", "preview", "notices"] as const;
export type InternalTabId = (typeof INTERNAL_TAB_IDS)[number];

export const INTERNAL_TAB_LABELS: Readonly<Record<InternalTabId, string>> = {
  delivery: "배송 안내",
  mismatch: "통관부호 불일치",
  preview: "안내표 미리보기",
  notices: "공지 현황"
};

export const DEFAULT_INTERNAL_TAB: InternalTabId = "delivery";

/** `?tab=` → a tab id; missing, unknown or repeated values open 배송 안내. */
export function parseInternalTab(value: string | readonly string[] | undefined): InternalTabId {
  const raw = typeof value === "string" ? value : value?.[0];
  return INTERNAL_TAB_IDS.find((id) => id === raw) ?? DEFAULT_INTERNAL_TAB;
}
