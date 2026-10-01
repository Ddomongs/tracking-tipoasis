import { expect, test } from "@playwright/test";
import type { Notice } from "@/lib/config/types";
import { groupNoticesAt, holidayAt, noticePlacementAt, noticeWindowAt } from "@/lib/cs/notice-status";
import { FIXTURE_CONFIG, FIXTURE_NOTICES } from "../fixtures/config-fixtures";
import { OCTOBER_NOW } from "../fixtures/derive-scenarios";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const kst = (local: string): Date => new Date(`${local}+09:00`);
const ids = (notices: readonly Notice[]): readonly string[] => notices.map((notice) => notice.id);

function fixtureNotice(id: string): Notice {
  const found = FIXTURE_NOTICES.find((notice) => notice.id === id);
  if (found === undefined) throw new Error(`missing fixture notice ${id}`);
  return found;
}

test("a notice is scheduled before startsAt, active from startsAt and expired from endsAt", () => {
  const outage = fixtureNotice("fx-outage");
  expect(noticeWindowAt(outage, kst("2026-09-26T21:59:59"))).toBe("scheduled");
  expect(noticeWindowAt(outage, kst("2026-09-26T22:00:00"))).toBe("active");
  expect(noticeWindowAt(outage, kst("2026-09-26T23:59:59"))).toBe("active");
  expect(noticeWindowAt(outage, kst("2026-09-27T00:00:00"))).toBe("expired");
});

test("a notice with an unreadable window counts as expired", () => {
  expect(noticeWindowAt({ ...fixtureNotice("fx-info"), startsAt: "언제나" }, FIXTURE_NOW)).toBe("expired");
});

test("groups: active by priority, scheduled by start, expired by the latest end", () => {
  const now = groupNoticesAt(FIXTURE_NOTICES, FIXTURE_NOW);
  expect([ids(now.active), ids(now.scheduled), ids(now.expired)]).toEqual([["fx-holiday", "fx-info"], ["fx-outage"], ["fx-expired"]]);
  expect(ids(groupNoticesAt(FIXTURE_NOTICES, kst("2026-09-26T22:30:00")).active)).toEqual(["fx-outage", "fx-holiday", "fx-info"]);
  expect(ids(groupNoticesAt(FIXTURE_NOTICES, kst("2026-08-01T09:00:00")).scheduled)).toEqual([
    "fx-expired",
    "fx-info",
    "fx-holiday",
    "fx-outage"
  ]);
  expect(ids(groupNoticesAt(FIXTURE_NOTICES, kst("2026-10-02T09:00:00")).expired)).toEqual([
    "fx-info",
    "fx-holiday",
    "fx-outage",
    "fx-expired"
  ]);
});

test("places at the fixture time: the home line, CS replies and the result states", () => {
  const places = noticePlacementAt(FIXTURE_NOTICES, FIXTURE_NOW);
  expect(places.home?.id).toBe("fx-holiday");
  expect(ids(places.cs)).toEqual(["fx-holiday"]);
  expect(places.results.map((place) => [place.guideKey, place.notice.id])).toEqual(
    ["pending", "customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp", "inTransit"].map((key) => [
      key,
      "fx-holiday"
    ])
  );
});

test("during the outage window the outage wins where it is listed, and waiting screens show only it", () => {
  const places = noticePlacementAt(FIXTURE_NOTICES, kst("2026-09-26T22:30:00"));
  expect(places.home?.id).toBe("fx-outage");
  expect(ids(places.cs)).toEqual(["fx-outage", "fx-holiday"]);
  expect(places.results.map((place) => [place.guideKey, place.notice.id])).toEqual([
    ["loading", "fx-outage"],
    ["notFound", "fx-outage"],
    ["temporaryDelay", "fx-outage"],
    ["offline", "fx-outage"],
    ["noResponse", "fx-outage"],
    ["pending", "fx-holiday"],
    ["customsArrived", "fx-holiday"],
    ["customsWaiting", "fx-outage"],
    ["customsCleared", "fx-holiday"],
    ["handedToCarrier", "fx-holiday"],
    ["pickedUp", "fx-holiday"],
    ["inTransit", "fx-holiday"]
  ]);
});

test("holidayAt names the holiday of the KST day, even when the UTC date is the day before", () => {
  const calendar = FIXTURE_CONFIG.calendar;
  expect(holidayAt(FIXTURE_NOW, calendar)?.id).toBe("2026-chuseok");
  expect(holidayAt(new Date("2026-09-23T15:30:00Z"), calendar)?.id).toBe("2026-chuseok");
  expect(holidayAt(new Date("2026-09-23T14:59:00Z"), calendar)).toBeNull();
  expect(holidayAt(kst("2026-10-09T09:00:00"), calendar)?.id).toBe("2026-hangul-day");
  expect(holidayAt(OCTOBER_NOW, calendar)).toBeNull();
});
