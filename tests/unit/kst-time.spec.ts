import { expect, test } from "@playwright/test";
import type { CalendarConfig } from "@/lib/config/types";
import {
  addCalendarDays, businessDaysAfter, calendarDaysBetween, formatKstDate, formatKstDateTight, formatKstDateTime,
  formatKstShortDateTime, formatKstTime, holidayPeriodBetween, isBusinessDay, isHoliday, kstDateKey, parseInstant, weekdayLabel
} from "@/lib/tracking/time";

const CALENDAR: CalendarConfig = {
  timeZone: "Asia/Seoul",
  carrierDeliversSaturday: false,
  holidays: [
    { id: "2026-chuseok", name: "추석 연휴", dates: ["2026-09-24", "2026-09-25", "2026-09-26"], badge: "추석 연휴 영향 · 1~2일 늦어질 수 있어요" },
    { id: "2026-foundation-day", name: "개천절", dates: ["2026-10-03", "2026-10-05"], badge: "개천절 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-hangul-day", name: "한글날", dates: ["2026-10-09"], badge: "한글날 영향 · 1일 늦어질 수 있어요" }
  ]
};
const SATURDAY_CALENDAR: CalendarConfig = { ...CALENDAR, carrierDeliversSaturday: true };

function describeTimeRows(): void {
  test("KST date keys switch at KST midnight", () => {
    expect(kstDateKey(new Date("2026-09-26T23:59:59+09:00"))).toBe("2026-09-26");
    expect(kstDateKey(new Date("2026-09-26T15:00:00Z"))).toBe("2026-09-27");
    expect(kstDateKey(new Date("2026-09-26T14:59:59Z"))).toBe("2026-09-26");
  });

  test("KST formats", () => {
    expect(formatKstDate("2026-09-30")).toBe("9월 30일 (수)");
    expect(formatKstDate(new Date("2026-09-30T23:30:00+09:00"))).toBe("9월 30일 (수)");
    expect(formatKstDateTight("2026-09-29")).toBe("9월 29일(화)");
    expect(formatKstDateTime(new Date("2026-09-23T14:10:00+09:00"))).toBe("9월 23일 (수) 14:10");
    expect(formatKstShortDateTime(new Date("2026-09-23T05:10:00Z"))).toBe("9월 23일 14:10");
    expect(formatKstTime(new Date("2026-10-12T08:05:00+09:00"))).toBe("08:05");
    expect(weekdayLabel("2026-09-26")).toBe("토");
  });
}

test.describe("KST keys and formats", () => {
  describeTimeRows();

  test("parseInstant returns null for anything that is not a date", () => {
    expect(parseInstant("")).toBeNull();
    expect(parseInstant("not-a-date")).toBeNull();
    expect(parseInstant("2026-09-23T14:10:00+09:00")?.toISOString()).toBe("2026-09-23T05:10:00.000Z");
  });

  test("calendar day arithmetic crosses months and years", () => {
    expect(addCalendarDays("2026-09-30", 2)).toBe("2026-10-02");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(calendarDaysBetween("2026-09-26", "2026-09-30")).toBe(4);
    expect(calendarDaysBetween("2026-09-30", "2026-09-26")).toBe(-4);
  });

  test("malformed or impossible date keys throw instead of producing NaN", () => {
    expect(() => formatKstDate("2026-02-30")).toThrow("없는 날짜입니다: 2026-02-30");
    expect(() => addCalendarDays("2026/09/30", 1)).toThrow("날짜 키 형식이 아닙니다: 2026/09/30");
  });
});

test.describe("business days", () => {
  test("holidays and weekends are not business days; Saturday counts only for carriers that deliver on Saturday", () => {
    expect(isHoliday("2026-09-25", CALENDAR)).toBe(true);
    expect(isHoliday("2026-10-04", CALENDAR)).toBe(false);
    expect(isBusinessDay("2026-09-28", CALENDAR, "customs")).toBe(true);
    expect(isBusinessDay("2026-09-26", CALENDAR, "delivery")).toBe(false);
    expect(isBusinessDay("2026-10-05", CALENDAR, "customs")).toBe(false);
    expect(isBusinessDay("2026-10-10", CALENDAR, "delivery")).toBe(false);
    expect(isBusinessDay("2026-10-10", SATURDAY_CALENDAR, "delivery")).toBe(true);
    expect(isBusinessDay("2026-10-10", SATURDAY_CALENDAR, "customs")).toBe(false);
    expect(isBusinessDay("2026-10-11", SATURDAY_CALENDAR, "delivery")).toBe(false);
  });

  test("spec example: customs cleared on 9/23 → handoff worry date 9/29", () => {
    expect(businessDaysAfter("2026-09-23", 2, CALENDAR, "customs")).toBe("2026-09-29");
  });

  test("business days skip the Chuseok holidays, 개천절 and its substitute day", () => {
    expect(businessDaysAfter("2026-09-25", 1, CALENDAR, "customs")).toBe("2026-09-28");
    expect(businessDaysAfter("2026-10-02", 1, CALENDAR, "customs")).toBe("2026-10-06");
    expect(businessDaysAfter("2026-10-08", 1, CALENDAR, "delivery")).toBe("2026-10-12");
    expect(businessDaysAfter("2026-10-08", 1, SATURDAY_CALENDAR, "delivery")).toBe("2026-10-10");
    expect(businessDaysAfter("2026-09-28", 0, CALENDAR, "customs")).toBe("2026-09-28");
  });

  test("a negative business-day count throws", () => {
    expect(() => businessDaysAfter("2026-09-28", -1, CALENDAR, "customs")).toThrow("영업일 수가 올바르지 않습니다: -1");
  });

  test("holiday overlap finds the first period touching the closed interval", () => {
    expect(holidayPeriodBetween("2026-09-23", "2026-09-30", CALENDAR)?.id).toBe("2026-chuseok");
    expect(holidayPeriodBetween("2026-09-26", "2026-09-26", CALENDAR)?.id).toBe("2026-chuseok");
    expect(holidayPeriodBetween("2026-09-28", "2026-10-02", CALENDAR)).toBeNull();
    expect(holidayPeriodBetween("2026-10-04", "2026-10-04", CALENDAR)).toBeNull();
    expect(holidayPeriodBetween("2026-10-05", "2026-10-05", CALENDAR)?.id).toBe("2026-foundation-day");
    expect(holidayPeriodBetween("2026-10-10", "2026-10-01", CALENDAR)).toBeNull();
  });
});

test.describe("same answers in America/New_York", () => {
  let previousTz: string | undefined;

  test.beforeAll(() => {
    previousTz = process.env.TZ;
    process.env.TZ = "America/New_York";
  });

  test.afterAll(() => {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });

  test("the process really runs in New York time", () => {
    expect(new Date("2026-09-26T00:00:00Z").getHours()).toBe(20);
  });

  describeTimeRows();

  test("business days are unchanged", () => {
    expect(businessDaysAfter("2026-09-23", 2, CALENDAR, "customs")).toBe("2026-09-29");
  });
});
