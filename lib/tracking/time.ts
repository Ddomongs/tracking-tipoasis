import type { CalendarConfig, HolidayPeriod } from "@/lib/config/types";

export type KstDateKey = string; // 'YYYY-MM-DD'
export type BusinessDayKind = "customs" | "delivery"; // delivery counts Saturday iff calendar.carrierDeliversSaturday

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // Korea has no daylight saving time
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_BUSINESS_DAY_SCAN = 400;
const SUNDAY = 0;
const SATURDAY = 6;

const pad2 = (value: number): string => String(value).padStart(2, "0");

function kstShifted(instant: Date): Date {
  return new Date(instant.getTime() + KST_OFFSET_MS);
}

function keyToUtcMs(key: KstDateKey): number {
  const match = DATE_KEY_PATTERN.exec(key);
  if (!match) throw new Error(`날짜 키 형식이 아닙니다: ${key}`);
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (new Date(ms).toISOString().slice(0, 10) !== key) throw new Error(`없는 날짜입니다: ${key}`);
  return ms;
}

function toKey(value: Date | KstDateKey): KstDateKey {
  return typeof value === "string" ? value : kstDateKey(value);
}

function monthDay(key: KstDateKey): { readonly month: number; readonly day: number } {
  const date = new Date(keyToUtcMs(key));
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function weekdayIndex(key: KstDateKey): number {
  return new Date(keyToUtcMs(key)).getUTCDay();
}

export function kstDateKey(instant: Date): KstDateKey {
  return kstShifted(instant).toISOString().slice(0, 10);
}

export function parseInstant(iso: string): Date | null {
  const value = new Date(iso);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function weekdayLabel(key: KstDateKey): string {
  return WEEKDAYS[weekdayIndex(key)];
}

/** '9월 30일 (수)' */
export function formatKstDate(value: Date | KstDateKey): string {
  const key = toKey(value);
  const { month, day } = monthDay(key);
  return `${month}월 ${day}일 (${weekdayLabel(key)})`;
}

/** '9월 29일(화)' — used inside sentences such as '…까지 그대로면 알려 주세요' */
export function formatKstDateTight(value: Date | KstDateKey): string {
  const key = toKey(value);
  const { month, day } = monthDay(key);
  return `${month}월 ${day}일(${weekdayLabel(key)})`;
}

/** '14:10' */
export function formatKstTime(instant: Date): string {
  const shifted = kstShifted(instant);
  return `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`;
}

/** '9월 23일 (수) 14:10' */
export function formatKstDateTime(instant: Date): string {
  return `${formatKstDate(instant)} ${formatKstTime(instant)}`;
}

/** '9월 23일 14:10' */
export function formatKstShortDateTime(instant: Date): string {
  const { month, day } = monthDay(kstDateKey(instant));
  return `${month}월 ${day}일 ${formatKstTime(instant)}`;
}

export function addCalendarDays(key: KstDateKey, days: number): KstDateKey {
  return new Date(keyToUtcMs(key) + days * DAY_MS).toISOString().slice(0, 10);
}

export function calendarDaysBetween(from: KstDateKey, to: KstDateKey): number {
  return Math.round((keyToUtcMs(to) - keyToUtcMs(from)) / DAY_MS);
}

export function isHoliday(key: KstDateKey, calendar: CalendarConfig): boolean {
  return calendar.holidays.some((period) => period.dates.includes(key));
}

export function isBusinessDay(key: KstDateKey, calendar: CalendarConfig, kind: BusinessDayKind): boolean {
  const weekday = weekdayIndex(key);
  if (weekday === SUNDAY) return false;
  if (weekday === SATURDAY && !(kind === "delivery" && calendar.carrierDeliversSaturday)) return false;
  return !isHoliday(key, calendar);
}

/** The `count`-th business day strictly after `start` (count 0 → start). */
export function businessDaysAfter(start: KstDateKey, count: number, calendar: CalendarConfig, kind: BusinessDayKind): KstDateKey {
  if (!Number.isInteger(count) || count < 0) throw new Error(`영업일 수가 올바르지 않습니다: ${count}`);
  keyToUtcMs(start);
  let current = start;
  let found = 0;
  let scanned = 0;
  while (found < count) {
    current = addCalendarDays(current, 1);
    scanned += 1;
    if (scanned > MAX_BUSINESS_DAY_SCAN) throw new Error(`영업일을 찾지 못했습니다: ${start}`);
    if (isBusinessDay(current, calendar, kind)) found += 1;
  }
  return current;
}

/** First holiday period with a date inside [from, to]; null when from > to or none overlaps. */
export function holidayPeriodBetween(from: KstDateKey, to: KstDateKey, calendar: CalendarConfig): HolidayPeriod | null {
  if (from > to) return null;
  return calendar.holidays.find((period) => period.dates.some((date) => date >= from && date <= to)) ?? null;
}
