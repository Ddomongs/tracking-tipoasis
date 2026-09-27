import type { Notice } from "@/lib/config/types";
import type { GuideKey, NoticeKind, NoticeView } from "@/lib/tracking/types";
import { parseInstant } from "@/lib/tracking/time";

export type NoticeSlot =
  | { readonly kind: "home" }
  | { readonly kind: "result"; readonly guideKey: GuideKey }
  | { readonly kind: "cs" };

export const NOTICE_PRIORITY: Readonly<Record<NoticeKind, number>> = { outage: 0, delay: 1, holiday: 2, info: 3 };

/** While a lookup waits or failed for a service reason only outage notices explain anything. */
const OUTAGE_ONLY_KEYS: ReadonlySet<GuideKey> = new Set<GuideKey>(["loading", "temporaryDelay", "offline", "noResponse"]);

function isActive(notice: Notice, nowMs: number): boolean {
  const starts = parseInstant(notice.startsAt);
  const ends = parseInstant(notice.endsAt);
  if (starts === null || ends === null) return false;
  return starts.getTime() <= nowMs && nowMs < ends.getTime();
}

function matchesSlot(notice: Notice, slot: NoticeSlot): boolean {
  switch (slot.kind) {
    case "home":
      return notice.home;
    case "cs":
      return notice.cs;
    case "result":
      if (!notice.guideKeys.includes(slot.guideKey)) return false;
      return !OUTAGE_ONLY_KEYS.has(slot.guideKey) || notice.kind === "outage";
  }
}

function startsAtMs(notice: Notice): number {
  return parseInstant(notice.startsAt)?.getTime() ?? 0;
}

function compareNotices(a: Notice, b: Notice): number {
  const byKind = NOTICE_PRIORITY[a.kind] - NOTICE_PRIORITY[b.kind];
  if (byKind !== 0) return byKind;
  const byStart = startsAtMs(b) - startsAtMs(a);
  if (byStart !== 0) return byStart;
  return a.id.localeCompare(b.id);
}

/** Active at `now` (startsAt ≤ now < endsAt), matching the slot, sorted by priority then latest startsAt. */
export function activeNotices(notices: readonly Notice[], now: Date, slot: NoticeSlot): readonly Notice[] {
  const nowMs = now.getTime();
  return notices.filter((notice) => isActive(notice, nowMs) && matchesSlot(notice, slot)).sort(compareNotices);
}

export function pickNotice(notices: readonly Notice[], now: Date, slot: NoticeSlot): Notice | null {
  return activeNotices(notices, now, slot)[0] ?? null;
}

export function toNoticeView(notice: Notice): NoticeView {
  return { id: notice.id, kind: notice.kind, title: notice.title, body: notice.body };
}
