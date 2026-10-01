import type { CalendarConfig, HolidayPeriod, Notice } from "@/lib/config/types";
import { NOTICE_PRIORITY, activeNotices, pickNotice } from "@/lib/tracking/notices";
import { holidayPeriodBetween, kstDateKey, parseInstant } from "@/lib/tracking/time";
import { GUIDE_KEYS, type GuideKey } from "@/lib/tracking/types";

// Internal-only (contract §11.1 rule 4): what the 공지 현황 tab shows for a chosen instant (spec §10 ④, §9 공지·연휴).
// Placements reuse lib/tracking/notices.ts, so the tab shows exactly what the pages would show at that instant.

export type NoticeWindow = "active" | "scheduled" | "expired";

export interface NoticeGroups {
  readonly active: readonly Notice[];
  readonly scheduled: readonly Notice[];
  readonly expired: readonly Notice[];
}

export interface NoticePlacement {
  /** The one line under the home header. */
  readonly home: Notice | null;
  /** Appended to CS replies, in priority order. */
  readonly cs: readonly Notice[];
  /** The in-card '안내' line per result state that has one. */
  readonly results: readonly { readonly guideKey: GuideKey; readonly notice: Notice }[];
}

const instantMs = (iso: string): number => parseInstant(iso)?.getTime() ?? Number.NaN;

export function noticeWindowAt(notice: Notice, now: Date): NoticeWindow {
  const starts = instantMs(notice.startsAt);
  const ends = instantMs(notice.endsAt);
  if (Number.isNaN(starts) || Number.isNaN(ends)) return "expired";
  const nowMs = now.getTime();
  if (nowMs < starts) return "scheduled";
  return nowMs < ends ? "active" : "expired";
}

const byPriority = (a: Notice, b: Notice): number =>
  NOTICE_PRIORITY[a.kind] - NOTICE_PRIORITY[b.kind] || instantMs(b.startsAt) - instantMs(a.startsAt) || a.id.localeCompare(b.id);
const byStart = (a: Notice, b: Notice): number => instantMs(a.startsAt) - instantMs(b.startsAt) || a.id.localeCompare(b.id);
const byLatestEnd = (a: Notice, b: Notice): number => instantMs(b.endsAt) - instantMs(a.endsAt) || a.id.localeCompare(b.id);

export function groupNoticesAt(notices: readonly Notice[], now: Date): NoticeGroups {
  const inWindow = (window: NoticeWindow): Notice[] => notices.filter((notice) => noticeWindowAt(notice, now) === window);
  return {
    active: inWindow("active").sort(byPriority),
    scheduled: inWindow("scheduled").sort(byStart),
    expired: inWindow("expired").sort(byLatestEnd)
  };
}

export function noticePlacementAt(notices: readonly Notice[], now: Date): NoticePlacement {
  return {
    home: pickNotice(notices, now, { kind: "home" }),
    cs: activeNotices(notices, now, { kind: "cs" }),
    results: GUIDE_KEYS.flatMap((guideKey) => {
      const notice = pickNotice(notices, now, { kind: "result", guideKey });
      return notice === null ? [] : [{ guideKey, notice }];
    })
  };
}

/** The holiday period that contains the KST calendar day of `now`, or null. */
export function holidayAt(now: Date, calendar: CalendarConfig): HolidayPeriod | null {
  const day = kstDateKey(now);
  return holidayPeriodBetween(day, day, calendar);
}
