import { expect, test } from "@playwright/test";
import { buildCsReply } from "@/lib/cs/cs-reply";
import { CS_TEMPLATES } from "@/lib/cs/cs-templates";
import { SITE_ORIGIN, buildReturnLink } from "@/lib/site";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { GUIDE_KEYS } from "@/lib/tracking/types";
import type { FailureCause, TrackingViewModel } from "@/lib/tracking/types";
import { FIXTURE_CONFIG } from "../fixtures/config-fixtures";
import {
  OCTOBER_NOW, PICKUP_NOW, ambiguousData, customsArrivedData, customsClearedData, customsWaitingData, deliveredData, failure,
  handedToCarrierData, inTransitData, lookupUnavailableData, pendingData, pickedUpData, staleData, success
} from "../fixtures/derive-scenarios";
import { FAKE, FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const CONFIG = FIXTURE_CONFIG;
const CONTEXT = { now: FIXTURE_NOW, notices: CONFIG.notices };
const FOLLOW_UP_PROMISE = /드리겠|안내해\s*드릴|연락\s*드릴|확인되는\s*(대로|즉시)/;
const INTERNAL_LABELS = /택배사 자동 확인|국내택배 자동 조회|도착전|조회 지연|택배사 선택 필요|AUTO|undefined|null|\{[A-Za-z]+\}/;
const CAUSES: readonly FailureCause[] = [
  "invalidNumber", "notFound", "rateLimited", "upstreamTimeout", "badGateway", "network", "offline", "clientTimeout", "serverError", "contractViolation"
];

test("customs waiting: status, ETA with the holiday, worry date and the self-service link", () => {
  const view = deriveTrackingView(success(customsWaitingData()), FIXTURE_NOW, CONFIG);
  const reply = buildCsReply(view, CONTEXT);
  const link = buildReturnLink(FAKE.hbl, "AUTO");
  expect(reply.short).toBe(
    `주문하신 상품은 지금 세관 통관 순서를 기다리고 있습니다. 도착 예상일은 9월 29일(화)이며 추석 연휴 영향으로 1~2일 늦어질 수 있습니다. 9월 28일(월)까지 변동이 없으면 다시 말씀해 주세요. 실시간 확인: ${link}`
  );
  expect(reply.customerLink).toBe(view.returnLink);
  expect(reply.long.split("\n")).toEqual([
    "주문하신 상품은 지금 세관 통관 순서를 기다리고 있습니다.",
    "세관 접수가 끝났고 순서대로 심사가 진행됩니다.",
    "최근 처리: 9월 23일 (수) 14:10 · 통관 접수",
    "도착 예상일은 9월 29일(화)이며 추석 연휴 영향으로 1~2일 늦어질 수 있습니다.",
    "9월 28일(월)까지 변동이 없으면 다시 말씀해 주세요.",
    `안내: ${CONFIG.notices[0].title} - ${CONFIG.notices[0].body}`,
    `실시간 확인: ${link}`
  ]);
});

test("overdue: says it is late and gives the first estimate instead of a worry date", () => {
  const now = new Date("2026-09-29T00:00:00+09:00");
  const view = deriveTrackingView(success(customsWaitingData()), now, CONFIG);
  expect(buildCsReply(view, { now, notices: CONFIG.notices }).short).toBe(
    `주문하신 상품은 지금 세관 통관 순서를 기다리고 있습니다. 예상보다 늦어지고 있어 확인이 필요합니다. 처음 안내한 도착 예상일은 9월 29일(화)입니다. 실시간 확인: ${view.returnLink}`
  );
});

test("in transit today and delivered", () => {
  const transit = buildCsReply(deriveTrackingView(success(inTransitData()), OCTOBER_NOW, CONFIG), { now: OCTOBER_NOW, notices: CONFIG.notices });
  expect(transit.short).toBe(
    `주문하신 상품은 지금 국내 배송 중입니다. 도착 예상일은 오늘, 10월 14일(수)입니다. 10월 15일(목)까지 변동이 없으면 다시 말씀해 주세요. 실시간 확인: ${buildReturnLink(FAKE.domestic, "CJ")}`
  );
  const delivered = buildCsReply(deriveTrackingView(success(deliveredData()), FIXTURE_NOW, CONFIG), CONTEXT);
  expect(delivered.short).toBe(`주문하신 상품은 배송이 완료되었습니다. 배송 완료일은 9월 25일(금)입니다. 실시간 확인: ${buildReturnLink(FAKE.domestic, "CJ")}`);
});

test("the new templates: NOT_FOUND, several carriers, carrier delay and errors", () => {
  const notFound = buildCsReply(deriveTrackingView(failure("notFound"), FIXTURE_NOW, CONFIG), CONTEXT);
  expect(notFound.short).toBe(
    `이 번호로는 아직 조회되는 정보가 없습니다. 번호가 주문내역과 같다면 한국 도착 전일 수 있습니다. 실시간 확인: ${buildReturnLink(FAKE.domestic, "AUTO")}`
  );
  expect(notFound.long).toContain("출고 안내를 받은 지 7일이 지나도 조회되지 않으면 다시 말씀해 주세요.");
  expect(buildCsReply(deriveTrackingView(success(ambiguousData()), FIXTURE_NOW, CONFIG), CONTEXT).short).toContain("같은 번호가 여러 택배사에 있어");
  expect(buildCsReply(deriveTrackingView(success(lookupUnavailableData("AUTO")), FIXTURE_NOW, CONFIG), CONTEXT).short).toContain("택배사 조회가 잠시 늦어");
  expect(buildCsReply(deriveTrackingView(failure("serverError"), FIXTURE_NOW, CONFIG), CONTEXT).short).toContain("일시적인 오류로 조회하지 못했습니다.");
});

test("an invalid number links to the lookup page instead of an invalid deep link", () => {
  const reply = buildCsReply(deriveTrackingView(failure("invalidNumber", { number: FAKE.invalidShort }), FIXTURE_NOW, CONFIG), CONTEXT);
  expect(reply.customerLink).toBe(`${SITE_ORIGIN}/`);
  expect(reply.short.endsWith(`실시간 확인: ${SITE_ORIGIN}/`)).toBe(true);
});

test("templates cover every guide key without follow-up promises", () => {
  expect(Object.keys(CS_TEMPLATES).sort()).toEqual([...GUIDE_KEYS].sort());
  for (const [key, template] of Object.entries(CS_TEMPLATES)) {
    expect(`${template.short} ${template.long}`, key).not.toMatch(FOLLOW_UP_PROMISE);
  }
});

test("replies for every state carry no internal labels, raw codes or unresolved tokens", () => {
  const septemberData = [
    customsArrivedData(), customsWaitingData(), customsClearedData(), pendingData(), deliveredData(), staleData(),
    lookupUnavailableData("AUTO"), lookupUnavailableData("CJ"), ambiguousData()
  ];
  const views: TrackingViewModel[] = [
    ...septemberData.map((data) => deriveTrackingView(success(data), FIXTURE_NOW, CONFIG)),
    deriveTrackingView(success(pickedUpData()), PICKUP_NOW, CONFIG),
    deriveTrackingView(success(handedToCarrierData()), PICKUP_NOW, CONFIG),
    deriveTrackingView(success(inTransitData()), OCTOBER_NOW, CONFIG),
    ...CAUSES.map((cause) => deriveTrackingView(failure(cause), FIXTURE_NOW, CONFIG))
  ];
  for (const view of views) {
    const reply = buildCsReply(view, CONTEXT);
    const text = `${reply.short}\n${reply.long}`;
    expect(text, view.guideKey).not.toMatch(INTERNAL_LABELS);
    expect(text, view.guideKey).not.toMatch(FOLLOW_UP_PROMISE);
    expect(reply.long.endsWith(`실시간 확인: ${reply.customerLink}`), view.guideKey).toBe(true);
  }
  expect(buildCsReply(views[5], CONTEXT).short).toContain("14일 넘게 새 처리 기록이 없어");
});
