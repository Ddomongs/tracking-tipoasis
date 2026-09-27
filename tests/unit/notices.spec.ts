import { expect, test } from "@playwright/test";
import type { Notice } from "@/lib/config/types";
import { NOTICE_PRIORITY, activeNotices, pickNotice, toNoticeView } from "@/lib/tracking/notices";

const HOLIDAY: Notice = {
  id: "holiday", kind: "holiday", title: "추석 연휴 배송 안내", body: "추석 연휴(9/24~26)와 주말에는 통관·택배가 쉬어요.",
  startsAt: "2026-09-21T00:00:00+09:00", endsAt: "2026-09-29T00:00:00+09:00", home: true,
  guideKeys: ["customsWaiting", "inTransit", "loading"], cs: true
};
const OUTAGE: Notice = {
  id: "outage", kind: "outage", title: "UNI-PASS 점검 안내", body: "UNI-PASS 점검(22:00~24:00) 중에는 통관 정보가 늦게 보일 수 있어요.",
  startsAt: "2026-09-26T22:00:00+09:00", endsAt: "2026-09-27T00:00:00+09:00", home: true,
  guideKeys: ["loading", "temporaryDelay", "customsWaiting"], cs: true
};
const INFO: Notice = {
  id: "info", kind: "info", title: "배송 조회 안내", body: "조회 결과는 저장하지 않아요.",
  startsAt: "2026-09-01T00:00:00+09:00", endsAt: "2026-10-01T00:00:00+09:00", home: true, guideKeys: [], cs: false
};
const DELAY_OLD: Notice = {
  id: "delay-old", kind: "delay", title: "배송 지연 안내", body: "택배사 물량이 많아 하루 늦어질 수 있어요.",
  startsAt: "2026-09-20T00:00:00+09:00", endsAt: "2026-09-30T00:00:00+09:00", home: true, guideKeys: ["inTransit"], cs: false
};
const DELAY_NEW: Notice = { ...DELAY_OLD, id: "delay-new", startsAt: "2026-09-25T00:00:00+09:00" };
const BROKEN: Notice = { ...INFO, id: "broken", startsAt: "not-a-date" };
const ALL: readonly Notice[] = [INFO, HOLIDAY, OUTAGE, DELAY_OLD, DELAY_NEW, BROKEN];

const AT_1405 = new Date("2026-09-26T14:05:00+09:00");
const AT_2230 = new Date("2026-09-26T22:30:00+09:00");
const ids = (notices: readonly Notice[]): readonly string[] => notices.map((notice) => notice.id);

test("priority is outage > delay > holiday > info", () => {
  expect(NOTICE_PRIORITY).toEqual({ outage: 0, delay: 1, holiday: 2, info: 3 });
});

test("home slot sorts by priority, then the latest start; broken dates never show", () => {
  expect(ids(activeNotices(ALL, AT_1405, { kind: "home" }))).toEqual(["delay-new", "delay-old", "holiday", "info"]);
  expect(pickNotice(ALL, AT_2230, { kind: "home" })?.id).toBe("outage");
});

test("windows are half-open in absolute time (22:00–24:00 KST = 13:00–15:00 UTC)", () => {
  expect(ids(activeNotices([OUTAGE], new Date("2026-09-26T12:59:59.999Z"), { kind: "home" }))).toEqual([]);
  expect(ids(activeNotices([OUTAGE], new Date("2026-09-26T13:00:00Z"), { kind: "home" }))).toEqual(["outage"]);
  expect(ids(activeNotices([OUTAGE], new Date("2026-09-26T14:59:59.999Z"), { kind: "home" }))).toEqual(["outage"]);
  expect(ids(activeNotices([OUTAGE], new Date("2026-09-26T15:00:00Z"), { kind: "home" }))).toEqual([]);
});

test("result slots match guide keys", () => {
  expect(ids(activeNotices(ALL, AT_1405, { kind: "result", guideKey: "customsWaiting" }))).toEqual(["holiday"]);
  expect(ids(activeNotices(ALL, AT_2230, { kind: "result", guideKey: "customsWaiting" }))).toEqual(["outage", "holiday"]);
  expect(ids(activeNotices(ALL, AT_1405, { kind: "result", guideKey: "inTransit" }))).toEqual(["delay-new", "delay-old", "holiday"]);
  expect(pickNotice(ALL, AT_1405, { kind: "result", guideKey: "delivered" })).toBeNull();
});

test("loading and waiting-error slots keep only outage notices", () => {
  expect(ids(activeNotices(ALL, AT_1405, { kind: "result", guideKey: "loading" }))).toEqual([]);
  expect(ids(activeNotices(ALL, AT_2230, { kind: "result", guideKey: "loading" }))).toEqual(["outage"]);
  expect(ids(activeNotices(ALL, AT_2230, { kind: "result", guideKey: "temporaryDelay" }))).toEqual(["outage"]);
});

test("cs slot takes only notices marked for CS replies", () => {
  expect(ids(activeNotices(ALL, AT_1405, { kind: "cs" }))).toEqual(["holiday"]);
});

test("the notice view has no window fields and the input list is not reordered", () => {
  expect(toNoticeView(HOLIDAY)).toEqual({ id: "holiday", kind: "holiday", title: HOLIDAY.title, body: HOLIDAY.body });
  activeNotices(ALL, AT_2230, { kind: "home" });
  expect(ids(ALL)).toEqual(["info", "holiday", "outage", "delay-old", "delay-new", "broken"]);
});
