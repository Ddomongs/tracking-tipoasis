import type { CalendarConfig } from "@/lib/config/types";
import { addCalendarDays, isHoliday, weekdayIndex, type KstDateKey } from "@/lib/tracking/time";

// Server-side estimate helpers (lib/services/normalizer.ts), kept out of time.ts so the browser bundle does not carry them.
const SUNDAY = 0;
const MAX_SCAN = 400;

/**
 * Days a carrier hands parcels to customers, for the arrival estimate (10월 4일 요청). Seven-day carriers (CJ 매일 오네)
 * deliver every day except the 설·추석 periods marked carriersRest; every other carrier rests on Sundays and holidays.
 */
export function isCarrierDeliveryDay(key: KstDateKey, calendar: CalendarConfig, carrierCode: string): boolean {
  if ((calendar.sevenDayCarriers ?? []).includes(carrierCode)) {
    return !calendar.holidays.some((period) => period.carriersRest === true && period.dates.includes(key));
  }
  return weekdayIndex(key) !== SUNDAY && !isHoliday(key, calendar);
}

/** The `count`-th day strictly after `start` that `counts` accepts (count 0 → start). */
export function countedDaysAfter(start: KstDateKey, count: number, counts: (key: KstDateKey) => boolean): KstDateKey {
  if (!Number.isInteger(count) || count < 0) throw new Error(`일수가 올바르지 않습니다: ${count}`);
  let current = start;
  let found = 0;
  let scanned = 0;
  while (found < count) {
    current = addCalendarDays(current, 1);
    scanned += 1;
    if (scanned > MAX_SCAN) throw new Error(`날짜를 찾지 못했습니다: ${start}`);
    if (counts(current)) found += 1;
  }
  return current;
}
