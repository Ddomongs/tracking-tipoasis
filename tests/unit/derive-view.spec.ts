import { expect, test } from "@playwright/test";
import { buildReturnLink } from "@/lib/site";
import { carrierOfficialUrl } from "@/lib/tracking/carriers";
import { classifyFailure } from "@/lib/tracking/classify-failure";
import { deriveTrackingView, guideKeyForData, isOverdue, worryDateKey } from "@/lib/tracking/derive-view";
import { PROBLEM_GUIDE_KEYS } from "@/lib/tracking/types";
import type {
  ActionView, CtaState, FailureCause, FailureInput, GuideKey, RevenueView, TrackingViewModel
} from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { FIXTURE_CONFIG, withConfig } from "../fixtures/config-fixtures";
import {
  CJ_URL, MOVED_NOW, OCTOBER_NOW, PICKUP_NOW, ambiguousData, carrierCutData, customsArrivedData, customsClearedData,
  customsReviewData, customsWaitingData, deliveredData, ev, failure, handedToCarrierData, inTransitData, lookupUnavailableData,
  movedEstimateData, pendingData, pickedUpData, staleData, success
} from "../fixtures/derive-scenarios";
import { FAKE, FAKE_GROUPED, FIXTURE_NOW, GAP3_06_VARIANTS, trackData } from "../fixtures/tracking-fixtures";
import { formatKstDate } from "@/lib/tracking/time";
import type { FixtureState } from "../fixtures/tracking-fixtures";

const CONFIG = FIXTURE_CONFIG;
const at = (iso: string): Date => new Date(iso);
const TALK_TEXT: ActionView = {
  kind: "talk", label: "톡톡으로 문의하기", weight: "text", href: CONFIG.channels.talk.url, external: true, cooldownSeconds: null
};
const COPY_AND_TALK: ActionView = {
  kind: "copyAndTalk", label: "문의 내용 복사하고 톡톡 열기", weight: "primary", href: CONFIG.channels.talk.url, external: true, cooldownSeconds: null
};
const NO_REVENUE: RevenueView = { tier: "none", stores: "none", recommendations: "none", recommendationContext: null, adsAllowed: false };
const ALL_CAUSES: readonly FailureCause[] = [
  "invalidNumber", "notFound", "rateLimited", "upstreamTimeout", "badGateway", "network", "offline", "clientTimeout", "serverError", "contractViolation"
];
const BASELINE_WAITING = deriveTrackingView(success(customsWaitingData()), FIXTURE_NOW, CONFIG);
const BASELINE_IN_TRANSIT = deriveTrackingView(success(inTransitData()), OCTOBER_NOW, CONFIG);
const BASELINE_OVERDUE = deriveTrackingView(success(customsWaitingData()), at("2026-09-29T00:00:00+09:00"), CONFIG);
const TALK_SECONDARY: ActionView = { ...TALK_TEXT, weight: "secondary" };
const RETRY_TEXT: ActionView = { kind: "retry", label: "다시 조회", weight: "text", href: null, external: false, cooldownSeconds: null };
const RETRY_SECONDARY: ActionView = { ...RETRY_TEXT, weight: "secondary" };

const GAP3_06_KEYS: Readonly<Partial<Record<FixtureState, GuideKey>>> = {
  pending: "pending", customsArrived: "customsArrived", customsWaiting: "customsWaiting", customsReview: "customsWaiting",
  customsCleared: "customsCleared", pickedUp: "pickedUp", inTransit: "inTransit", delivered: "delivered", stale: "stale",
  lookupUnavailableAuto: "lookupUnavailable", lookupUnavailableCarrier: "lookupUnavailable", ambiguous: "ambiguous"
};
const ERROR_CODE_INPUTS: readonly FailureInput[] = [
  { kind: "http", status: 400, code: "INVALID_NUMBER", isJson: true },
  { kind: "http", status: 504, code: "API_TIMEOUT", isJson: true },
  { kind: "http", status: 404, code: "NOT_FOUND", isJson: true },
  { kind: "http", status: 500, code: "SERVER_ERROR", isJson: true },
  { kind: "http", status: 429, code: "RATE_LIMITED", isJson: true }
];
const CTA_BY_KEY: Readonly<Partial<Record<GuideKey, CtaState>>> = {
  pending: "pending", customsArrived: "customsWaiting", customsWaiting: "customsWaiting", customsCleared: "customsCleared",
  handedToCarrier: "customsCleared", pickedUp: "customsCleared", inTransit: "inTransit", delivered: "delivered",
  stale: "stale", lookupUnavailable: "lookupUnavailable", ambiguous: "ambiguous"
};
const PROBLEM_KEYS: ReadonlySet<GuideKey> = new Set<GuideKey>(PROBLEM_GUIDE_KEYS);
const NORMAL_WAITING: ReadonlySet<GuideKey> = new Set<GuideKey>(["customsArrived", "customsWaiting", "customsCleared"]);
const UNRESOLVED_TOKEN = /\{[A-Za-z]+\}/;

/** The rules GAP3-06 found broken in 8 of 12 variants; returns one message per rule a view breaks. */
function contradictions(view: TrackingViewModel): readonly string[] {
  const actions = [view.nextAction.primary, ...view.nextAction.secondary].filter((item): item is ActionView => item !== null);
  const firstLinkKind = actions.find((item) => item.href !== null)?.kind;
  const stores = view.nextAction.stores;
  const texts = [
    view.title, view.reason ?? "", view.chip ?? "", view.nextAction.sentence, view.nextAction.worry?.text ?? "",
    view.nextAction.note ?? "", view.documentTitle, view.liveMessage
  ];
  const problem = view.mode === "error" || PROBLEM_KEYS.has(view.guideKey) || view.overdue;
  const rules: ReadonlyArray<readonly [string, boolean]> = [
    ["CTA state matches the summary", view.ctaState !== (view.mode === "error" ? "error" : CTA_BY_KEY[view.guideKey])],
    ["at most two secondary actions", view.nextAction.secondary.length > 2],
    ["no unresolved tokens", texts.some((text) => UNRESOLVED_TOKEN.test(text))],
    ["problem states carry no stores, recommendations or ads",
      problem && (stores !== null || view.revenue.stores !== "none" || view.revenue.recommendations !== "none" || view.revenue.adsAllowed)],
    ["in transit keeps stores out of the CTA", view.guideKey === "inTransit" && stores !== null],
    ["delivered leads with the stores", view.guideKey === "delivered" && stores?.links[0]?.weight !== "primary"],
    ["pending offers 톡톡 and purchase choices",
      view.guideKey === "pending" && (stores?.placement !== "pending" || !actions.some((item) => item.kind === "talk"))],
    ["stale withholds the estimate", view.guideKey === "stale" && view.eta.kind !== "withheld"],
    ["pending shows '정보 등록 후 안내'", view.guideKey === "pending" && view.eta.kind !== "pendingInfo"],
    ["carrier links only with the known official URL",
      actions.some((item) => item.kind === "carrierOfficial" && (item.href === null || item.href !== view.carrier.officialUrl))],
    ["'배송이 진행 중이에요' only while in transit", view.nextAction.heading === "배송이 진행 중이에요" && view.guideKey !== "inTransit"],
    ["'아직 국내 배송 정보가 없어요' only while pending", view.nextAction.heading === "아직 국내 배송 정보가 없어요" && view.guideKey !== "pending"],
    ["normal waiting has no filled button", NORMAL_WAITING.has(view.guideKey) && !view.overdue && view.nextAction.primary !== null],
    ["red only for real errors", view.tone === "problem" && view.guideKey !== "serverError"],
    ["overdue uses the attention tone and copy-and-talk", view.overdue && (view.tone !== "attention" || view.nextAction.primary?.kind !== "copyAndTalk")],
    ["disclosure exactly when a link is affiliate",
      stores !== null && (stores.disclosure !== null) !== stores.links.some((link) => link.isAffiliate)],
    ["spine position only with a current station", (view.spine.current === null) !== (view.spine.positionLabel === null)],
    ["errors lead with 톡톡", view.mode === "error" && firstLinkKind !== "talk" && firstLinkKind !== "copyAndTalk"],
    ["copy actions carry the inquiry text", actions.some((item) => item.kind === "copyAndTalk") !== (view.inquiryCopy !== null)]
  ];
  return rules.filter(([, broken]) => broken).map(([rule]) => `${view.guideKey}${view.overdue ? " (overdue)" : ""}: ${rule}`);
}

interface KeyRow { readonly name: string; readonly data: TrackResponseData; readonly now: Date; readonly key: GuideKey }

const cleared = customsClearedData();
const KEY_ROWS: readonly KeyRow[] = [
  { name: "ambiguous with 0 events", data: ambiguousData(), now: FIXTURE_NOW, key: "ambiguous" },
  { name: "carrier lookup delay with 0 events", data: lookupUnavailableData("AUTO"), now: FIXTURE_NOW, key: "lookupUnavailable" },
  { name: "pending (domestic, no record)", data: pendingData(), now: FIXTURE_NOW, key: "pending" },
  { name: "delivered", data: deliveredData(), now: FIXTURE_NOW, key: "delivered" },
  { name: "delivered wins over a stale flag", data: { ...deliveredData(), estimateStale: true }, now: FIXTURE_NOW, key: "delivered" },
  { name: "stale by the server flag", data: staleData(), now: FIXTURE_NOW, key: "stale" },
  { name: "stale when read 15 days after the last event", data: customsWaitingData(), now: at("2026-10-08T14:10:00+09:00"), key: "stale" },
  { name: "exactly 14 days is not stale yet", data: customsWaitingData(), now: at("2026-10-07T14:10:00+09:00"), key: "customsWaiting" },
  { name: "in transit (code 6)", data: inTransitData(), now: OCTOBER_NOW, key: "inTransit" },
  { name: "picked up (code 5, 집화)", data: pickedUpData(), now: PICKUP_NOW, key: "pickedUp" },
  { name: "handed to carrier (code 5, not a pickup)", data: handedToCarrierData(), now: PICKUP_NOW, key: "handedToCarrier" },
  { name: "customs cleared (code 4)", data: cleared, now: FIXTURE_NOW, key: "customsCleared" },
  { name: "carrier delay with customs events stays code-based", data: carrierCutData(), now: FIXTURE_NOW, key: "customsCleared" },
  { name: "several carriers with customs events stays code-based", data: { ...cleared, delivery: { ...cleared.delivery, ambiguous: true } }, now: FIXTURE_NOW, key: "customsCleared" },
  { name: "customs waiting (code 2)", data: customsWaitingData(), now: FIXTURE_NOW, key: "customsWaiting" },
  { name: "customs review (code 3)", data: customsReviewData(), now: FIXTURE_NOW, key: "customsWaiting" },
  { name: "arrived (code 1)", data: customsArrivedData(), now: FIXTURE_NOW, key: "customsArrived" }
];

test.describe("guide keys from data (priority order)", () => {
  for (const row of KEY_ROWS) {
    test(row.name, () => {
      expect(guideKeyForData(row.data, row.now, CONFIG)).toBe(row.key);
    });
  }
});

test.describe("worry dates", () => {
  test("customs waiting: the moved estimate is capped by the last customs event + 2 days, then + 1 business day", () => {
    expect(worryDateKey(customsWaitingData(), "customsWaiting", CONFIG)).toBe("2026-09-28");
  });

  test("arrived: estimate 9/27 (Sun) + 1 business day", () => {
    expect(worryDateKey(customsArrivedData(), "customsArrived", CONFIG)).toBe("2026-09-28");
  });

  test("customs cleared: spec example 9/23 → 9/29 (추석 and the weekend skipped)", () => {
    expect(worryDateKey(customsClearedData(), "customsCleared", CONFIG)).toBe("2026-09-29");
  });

  test("picked up or handed over: 2 business days after the latest progress, skipping 한글날 and the weekend", () => {
    expect(worryDateKey(pickedUpData(), "pickedUp", CONFIG)).toBe("2026-10-13");
    expect(worryDateKey(handedToCarrierData(), "handedToCarrier", CONFIG)).toBe("2026-10-13");
  });

  test("in transit: delivery estimate + 1 delivery business day", () => {
    expect(worryDateKey(inTransitData(), "inTransit", CONFIG)).toBe("2026-10-15");
  });

  test("an estimate the server moved to today no longer moves the worry date", () => {
    expect(worryDateKey(movedEstimateData(), "customsWaiting", CONFIG)).toBe("2026-09-18");
    expect(isOverdue("2026-09-18", MOVED_NOW)).toBe(true);
  });

  test("states without a date-based worry line", () => {
    expect(worryDateKey(pendingData(), "pending", CONFIG)).toBeNull();
    expect(worryDateKey(deliveredData(), "delivered", CONFIG)).toBeNull();
    expect(worryDateKey(staleData(), "stale", CONFIG)).toBeNull();
    expect(worryDateKey(lookupUnavailableData("AUTO"), "lookupUnavailable", CONFIG)).toBeNull();
    expect(worryDateKey(ambiguousData(), "ambiguous", CONFIG)).toBeNull();
  });
});

function overdueBoundaryRows(): void {
  const worry = "2026-09-28";

  test("overdue: day before, day of, day after (KST)", () => {
    expect(isOverdue(worry, at("2026-09-27T12:00:00+09:00"))).toBe(false);
    expect(isOverdue(worry, at("2026-09-28T12:00:00+09:00"))).toBe(false);
    expect(isOverdue(worry, at("2026-09-29T09:00:00+09:00"))).toBe(true);
  });

  test("overdue flips exactly at KST midnight", () => {
    expect(isOverdue(worry, at("2026-09-28T23:59:59+09:00"))).toBe(false);
    expect(isOverdue(worry, at("2026-09-29T00:00:00+09:00"))).toBe(true);
    expect(isOverdue(worry, at("2026-09-28T15:00:00Z"))).toBe(true);
  });
}

test.describe("overdue", () => {
  overdueBoundaryRows();

  test("no worry date is never overdue", () => {
    expect(isOverdue(null, at("2030-01-01T00:00:00+09:00"))).toBe(false);
  });
});

test.describe("state keys and dates in America/New_York", () => {
  let previousTz: string | undefined;

  test.beforeAll(() => {
    previousTz = process.env.TZ;
    process.env.TZ = "America/New_York";
  });

  test.afterAll(() => {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });

  test("keys and worry dates do not depend on the device time zone", () => {
    expect(new Date("2026-09-26T00:00:00Z").getHours()).toBe(20);
    expect(guideKeyForData(customsWaitingData(), FIXTURE_NOW, CONFIG)).toBe("customsWaiting");
    expect(worryDateKey(customsWaitingData(), "customsWaiting", CONFIG)).toBe("2026-09-28");
    expect(worryDateKey(inTransitData(), "inTransit", CONFIG)).toBe("2026-10-15");
  });

  overdueBoundaryRows();
});

test.describe("result view models", () => {
  test("customs waiting: calm progress, holiday badge instead of D-n, worry line bound to 톡톡", () => {
    const view = BASELINE_WAITING;
    expect(view.guideKey).toBe("customsWaiting");
    expect(view.mode).toBe("settled");
    expect(view.tone).toBe("progress");
    expect(view.overdue).toBe(false);
    expect(view.number).toEqual({ raw: FAKE.hbl, grouped: FAKE_GROUPED.hbl });
    expect(view.carrier).toEqual({ code: "AUTO", name: null, barLabel: "택배사 배정 전", officialUrl: null });
    expect(view.chip).toBe("통관 대기 · 2/4");
    expect(view.title).toBe("통관 순서를 기다리고 있어요");
    expect(view.reason).toBe("세관 접수가 끝났고 순서대로 심사가 진행돼요.");
    expect(view.spine).toEqual({ current: "customs", issue: null, handoffPending: false, positionLabel: "2/4" });
    expect(view.eta).toEqual({
      kind: "holidayAffected", label: "도착 예상",
      date: { key: "2026-09-29", label: "9월 29일 (화)", month: 9, day: 29, weekday: "화" },
      badge: "추석 연휴 영향 · 1~2일 늦어질 수 있어요", holidayName: "추석 연휴", caption: "통관 완료 예상 9월 26일 (토)"
    });
    expect(view.nextAction).toEqual({
      heading: "지금 할 일",
      sentence: "지금은 하실 일이 없어요. 통관이 끝나면 택배사로 넘어가요.",
      primary: null,
      secondary: [{ kind: "copyReturnLink", label: "다시 볼 링크 복사", weight: "secondary", href: null, external: false, cooldownSeconds: null }],
      worry: { dateKey: "2026-09-28", text: "9월 28일(월)까지 그대로면 알려 주세요", talk: TALK_TEXT },
      stores: null, carrierChoices: null, note: null
    });
    expect(view.notice?.id).toBe("fx-holiday");
    expect(view.lastEvent).toEqual({
      at: "2026-09-23T05:10:00.000Z", label: "통관 접수", original: "통관목록접수", place: "인천공항세관", text: "9월 23일 (수) 14:10 · 통관 접수"
    });
    expect(view.history.count).toBe(2);
    expect(view.history.summaryText).toBe("처리 내역 2건 보기 · 마지막 9월 23일 14:10");
    expect(view.history.emptyText).toBeNull();
    expect(view.history.segments.map((segment) => [segment.station, segment.title, segment.events.length])).toEqual([["customs", "입항·통관", 2]]);
    expect(view.history.recent.map((item) => item.label)).toEqual(["통관 접수", "입항"]);
    expect(view.ctaState).toBe("customsWaiting");
    expect(view.inquiryLevel).toBe("worryLink");
    expect(view.revenue).toEqual({ tier: "quiet", stores: "none", recommendations: "optional", recommendationContext: "customsWaiting", adsAllowed: true });
    expect(view.retry).toBeNull();
    expect(view.auxiliaryLine).toBeNull();
    expect(view.help.map((item) => [item.id, item.defaultOpen])).toEqual([["customs-delay", false]]);
    expect(view.inquiryCopy).toBeNull();
    expect(view.returnLink).toBe(buildReturnLink(FAKE.hbl, "AUTO"));
    expect(view.documentTitle).toBe("통관 대기 중 · 배송 조회");
    expect(view.liveMessage).toBe("통관 순서를 기다리고 있어요 · 도착 예상 9월 29일 (화)");
  });

  test("customs waiting turns overdue at KST midnight after the worry date", () => {
    expect(deriveTrackingView(success(customsWaitingData()), at("2026-09-28T23:59:59+09:00"), CONFIG).overdue).toBe(false);
    const view = BASELINE_OVERDUE;
    expect(view.overdue).toBe(true);
    expect(view.guideKey).toBe("customsWaiting");
    expect(view.tone).toBe("attention");
    expect(view.chip).toBe("확인 필요 · 2/4");
    expect(view.title).toBe("9월 28일(월)이 지났는데 아직 통관이 끝나지 않았어요");
    expect(view.eta).toEqual({
      kind: "overdue", label: "예상했던 날짜", date: { key: "2026-09-29", label: "9월 29일 (화)", month: 9, day: 29, weekday: "화" }
    });
    expect(view.nextAction.primary).toEqual(COPY_AND_TALK);
    expect(view.nextAction.secondary).toEqual([]);
    expect(view.nextAction.worry).toBeNull();
    expect(view.nextAction.sentence).toBe("확인이 필요해요. 문의 내용을 복사해 톡톡으로 보내 주세요.");
    expect(view.nextAction.note).toBe("개인통관고유부호와 수취인 이름이 주문 정보와 같은지도 확인해 주세요");
    expect(view.inquiryCopy).toBe(`[배송 문의] 조회번호 ${FAKE_GROUPED.hbl} / 마지막 단계 통관 대기 / 마지막 처리 9월 23일 14:10`);
    expect(view.inquiryLevel).toBe("primary");
    expect(view.ctaState).toBe("customsWaiting");
    expect(view.revenue).toEqual(NO_REVENUE);
    expect(view.notice).toBeNull();
  });

  test("overdue rows: the day before, the day of and the day after the worry date", () => {
    const data = customsWaitingData();
    expect(deriveTrackingView(success(data), at("2026-09-27T12:00:00+09:00"), CONFIG).overdue).toBe(false);
    expect(deriveTrackingView(success(data), at("2026-09-28T12:00:00+09:00"), CONFIG).overdue).toBe(false);
    expect(deriveTrackingView(success(data), at("2026-09-29T09:00:00+09:00"), CONFIG).overdue).toBe(true);
  });

  test("customs cleared: handoff pending on the customs station, spec worry date 9/29", () => {
    const view = deriveTrackingView(success(customsClearedData()), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("customsCleared");
    expect(view.chip).toBe("통관 완료 · 2/4");
    expect(view.title).toBe("통관이 끝났어요");
    expect(view.spine).toEqual({ current: "customs", issue: null, handoffPending: true, positionLabel: "2/4" });
    expect(view.eta).toMatchObject({ kind: "holidayAffected", date: { key: "2026-09-26" }, caption: "통관 완료 9월 23일 (수)" });
    expect(view.nextAction.worry?.text).toBe("9월 29일(화)까지 소식이 없으면 알려 주세요");
    expect(view.nextAction.primary).toBeNull();
    expect(view.lastEvent?.text).toBe("9월 23일 (수) 10:05 · 통관 완료");
    expect(view.lastEvent?.original).toBe("수입신고수리");
    expect(view.carrier.barLabel).toBe("택배사 배정 전");
    expect(view.ctaState).toBe("customsCleared");
    expect(view.revenue.recommendationContext).toBe("customsCleared");
    expect(view.help.map((item) => item.id)).toEqual(["handoff"]);
  });

  test("in transit: today's estimate, live carrier link as primary, driver call, no stores", () => {
    const view = BASELINE_IN_TRANSIT;
    expect(view.guideKey).toBe("inTransit");
    expect(view.chip).toBe("국내 배송 · 3/4");
    expect(view.title).toBe("국내 배송 중");
    expect(view.carrier).toEqual({ code: "CJ", name: "CJ대한통운", barLabel: "CJ대한통운", officialUrl: CJ_URL });
    expect(view.eta).toEqual({
      kind: "today", label: "오늘 예상", date: { key: "2026-10-14", label: "10월 14일 (수)", month: 10, day: 14, weekday: "수" }, caption: null
    });
    expect(view.nextAction.heading).toBe("배송이 진행 중이에요");
    expect(view.nextAction.primary).toEqual({
      kind: "carrierOfficial", label: "CJ대한통운에서 실시간 위치 보기", weight: "primary", href: CJ_URL, external: true, cooldownSeconds: null
    });
    expect(view.nextAction.secondary).toEqual([
      { kind: "callDriver", label: "기사님께 전화", weight: "secondary", href: `tel:${FAKE.phone.replace(/-/g, "")}`, external: false, cooldownSeconds: null },
      TALK_TEXT
    ]);
    expect(view.nextAction.worry).toEqual({ dateKey: "2026-10-15", text: "10월 15일(목)까지 안 오면 알려 주세요", talk: TALK_TEXT });
    expect(view.nextAction.stores).toBeNull();
    expect(view.revenue).toEqual({ tier: "quiet", stores: "none", recommendations: "inline", recommendationContext: "inTransit", adsAllowed: true });
    expect(view.inquiryLevel).toBe("textLink");
    expect(view.history.count).toBe(4);
    expect(view.history.segments.map((segment) => segment.station)).toEqual(["customs", "domestic"]);
    expect(view.history.summaryText).toBe("처리 내역 4건 보기 · 마지막 10월 12일 08:15");
    expect(view.returnLink).toBe(buildReturnLink(FAKE.domestic, "CJ"));
    expect(view.liveMessage).toBe("국내 배송 중 · 오늘 예상 10월 14일 (수)");
  });

  test("in transit turns overdue after 10/15 and keeps the official lookup as the only secondary", () => {
    const view = deriveTrackingView(success(inTransitData()), at("2026-10-16T00:00:00+09:00"), CONFIG);
    expect(view.overdue).toBe(true);
    expect(view.title).toBe("10월 15일(목)이 지났는데 아직 배송이 끝나지 않았어요");
    expect(view.nextAction.primary).toEqual(COPY_AND_TALK);
    expect(view.nextAction.secondary).toEqual([
      { kind: "carrierOfficial", label: "CJ대한통운 공식 배송조회", weight: "secondary", href: CJ_URL, external: true, cooldownSeconds: null }
    ]);
    expect(view.nextAction.note).toBeNull();
    expect(view.revenue).toEqual(NO_REVENUE);
  });

  test("pending: number check first, 톡톡 button, purchase choices after the disclosure, recheck note", () => {
    const view = deriveTrackingView(success(pendingData()), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("pending");
    expect(view.tone).toBe("waiting");
    expect(view.chip).toBe("국내 도착 전");
    expect(view.title).toBe("통관 정보 등록 전");
    expect(view.spine).toEqual({ current: null, issue: null, handoffPending: false, positionLabel: null });
    expect(view.eta).toEqual({ kind: "pendingInfo", label: "도착 예상", text: "정보 등록 후 안내" });
    expect(view.nextAction.heading).toBe("아직 국내 배송 정보가 없어요");
    expect(view.nextAction.primary).toEqual({ kind: "fixNumber", label: "번호 수정", weight: "primary", href: null, external: false, cooldownSeconds: null });
    expect(view.nextAction.secondary.map((item) => [item.kind, item.weight])).toEqual([["talk", "secondary"], ["copyReturnLink", "text"]]);
    expect(view.nextAction.worry).toEqual({ dateKey: null, text: "출고 안내 후 10일이 지나도 이 화면이면 알려 주세요", talk: TALK_TEXT });
    expect(view.nextAction.stores).toEqual({
      placement: "pending", intro: "주문하신 곳에서도 배송 안내를 볼 수 있어요", disclosure: CONFIG.disclosures.coupang,
      links: [
        { channel: "naver", label: "네이버 스토어 보기", href: CONFIG.channels.naver.urls.pending, isAffiliate: false, weight: "secondary" },
        { channel: "coupang", label: "쿠팡 스토어 보기", href: CONFIG.channels.coupang.urls.pending, isAffiliate: true, weight: "secondary" }
      ]
    });
    expect(view.nextAction.note).toBe(CONFIG.durations.pendingRecheck);
    expect(view.revenue).toEqual({ tier: "quiet", stores: "purchaseChoices", recommendations: "inline", recommendationContext: "pending", adsAllowed: true });
    expect(view.ctaState).toBe("pending");
    expect(view.inquiryLevel).toBe("ctaButton");
    expect(view.history).toEqual({ count: 0, summaryText: "처리 내역 0건 보기", emptyText: "아직 처리 내역이 없어요", segments: [], recent: [] });
    expect(view.lastEvent).toBeNull();
    expect(view.help.map((item) => item.id)).toEqual(["pre-arrival", "order-check"]);
  });

  test("delivered: done tone, delivered-on date, stores lead with the disclosure first", () => {
    const view = deriveTrackingView(success(deliveredData()), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("delivered");
    expect(view.tone).toBe("done");
    expect(view.chip).toBe("도착 · 4/4");
    expect(view.spine.current).toBe("arrived");
    expect(view.eta).toEqual({
      kind: "deliveredOn", label: "배송 완료일", date: { key: "2026-09-25", label: "9월 25일 (금)", month: 9, day: 25, weekday: "금" }
    });
    expect(view.lastEvent).toMatchObject({ place: "문 앞", text: "9월 25일 (금) 14:32 · 배송 완료" });
    expect(view.nextAction.primary).toBeNull();
    expect(view.nextAction.stores?.placement).toBe("deliveredLead");
    expect(view.nextAction.stores?.disclosure).toBe(CONFIG.disclosures.coupang);
    expect(view.nextAction.stores?.links.map((link) => [link.channel, link.weight])).toEqual([["naver", "primary"], ["coupang", "secondary"]]);
    expect(view.nextAction.secondary.map((item) => [item.kind, item.label])).toEqual([["talk", "톡톡으로 문의하기"], ["undeliveredHelp", "받지 못하셨나요?"]]);
    expect(view.revenue).toEqual({ tier: "lead", stores: "ctaLead", recommendations: "inline", recommendationContext: "delivered", adsAllowed: true });
    expect(view.inquiryLevel).toBe("afterStores");
  });

  test("stale: attention tone, stopped mark, estimate withheld, copy-and-talk first", () => {
    const view = deriveTrackingView(success(staleData()), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("stale");
    expect(view.tone).toBe("attention");
    expect(view.chip).toBe("확인 필요 · 2/4");
    expect(view.title).toBe("14일 넘게 새 소식이 없어요");
    expect(view.reason).toBe("마지막 처리는 9월 6일(일)이에요. 보통은 1~2일 안에 다음 단계로 넘어가요.");
    expect(view.spine).toEqual({ current: "customs", issue: { at: "customs", kind: "stopped", label: "멈춤" }, handoffPending: false, positionLabel: "2/4" });
    expect(view.eta).toEqual({ kind: "withheld", label: "도착 예상", text: "지금은 도착 예상일을 안내하기 어려워요" });
    expect(view.nextAction.primary).toEqual(COPY_AND_TALK);
    expect(view.nextAction.secondary).toEqual([]);
    expect(view.nextAction.note).toBe("개인통관고유부호와 수취인 이름이 주문 정보와 같은지도 확인해 주세요");
    expect(view.inquiryCopy).toBe(`[배송 문의] 조회번호 ${FAKE_GROUPED.domestic} / 마지막 단계 통관 대기 / 마지막 처리 9월 6일 10:00`);
    expect(view.revenue).toEqual(NO_REVENUE);
    expect(view.ctaState).toBe("stale");
    expect(view.help.map((item) => [item.id, item.defaultOpen])).toEqual([["customs-delay", true], ["stale-causes", false]]);
  });

  test("carrier lookup delay without a carrier: cut mark and carrier chips for an instant re-lookup", () => {
    const view = deriveTrackingView(success(lookupUnavailableData("AUTO")), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("lookupUnavailable");
    expect(view.carrier.barLabel).toBe("택배사");
    expect(view.spine).toEqual({ current: "domestic", issue: { at: "domestic", kind: "cut", label: "끊김" }, handoffPending: false, positionLabel: "3/4" });
    expect(view.eta).toEqual({ kind: "none" });
    expect(view.nextAction.primary).toBeNull();
    expect(view.nextAction.sentence).toBe("택배사를 고르시면 같은 번호로 바로 다시 조회해요.");
    expect(view.nextAction.carrierChoices?.map((choice) => choice.name)).toEqual(["CJ대한통운", "우체국택배", "한진택배", "롯데택배", "로젠택배"]);
    expect(view.nextAction.secondary.map((item) => [item.kind, item.weight])).toEqual([["retry", "secondary"], ["talk", "text"]]);
    expect(view.revenue).toEqual(NO_REVENUE);
  });

  test("carrier lookup delay with a known carrier: the official lookup is the primary action", () => {
    const view = deriveTrackingView(success(lookupUnavailableData("CJ")), FIXTURE_NOW, CONFIG);
    expect(view.nextAction.primary).toEqual({
      kind: "carrierOfficial", label: "CJ대한통운 공식 배송조회", weight: "primary", href: CJ_URL, external: true, cooldownSeconds: null
    });
    expect(view.nextAction.sentence).toBe("CJ대한통운 공식 조회에서 바로 확인할 수 있어요.");
    expect(view.nextAction.carrierChoices).toBeNull();
  });

  test("several carriers: branch mark and carrier chips", () => {
    const view = deriveTrackingView(success(ambiguousData()), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("ambiguous");
    expect(view.spine.issue).toEqual({ at: "domestic", kind: "branch", label: "갈림" });
    expect(view.nextAction.carrierChoices).toHaveLength(5);
    expect(view.nextAction.primary).toBeNull();
    expect(view.nextAction.secondary.map((item) => item.kind)).toEqual(["talk"]);
    expect(view.ctaState).toBe("ambiguous");
  });

  test("customs events with a carrier lookup delay: code-based state, cut mark and a retry line", () => {
    const view = deriveTrackingView(success(carrierCutData()), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("customsCleared");
    expect(view.spine).toEqual({ current: "customs", issue: { at: "domestic", kind: "cut", label: "끊김" }, handoffPending: true, positionLabel: "2/4" });
    expect(view.auxiliaryLine).toEqual({
      text: "택배사 조회가 잠시 늦어요", action: { kind: "retry", label: "다시 조회", weight: "text", href: null, external: false, cooldownSeconds: null }
    });
    expect(view.carrier.name).toBe("CJ대한통운");
  });

  test("picked up: the E2E title with the carrier name and the official lookup as primary", () => {
    const view = deriveTrackingView(success(pickedUpData()), PICKUP_NOW, CONFIG);
    expect(view.title).toBe("CJ대한통운 기사님 픽업 완료!");
    expect(view.reason).toBe("CJ대한통운 기사님이 상품을 인수해 배송 출발을 준비하고 있어요.");
    expect(view.chip).toBe("국내 배송 · 3/4");
    expect(view.nextAction.primary?.label).toBe("CJ대한통운 공식 배송조회");
    expect(view.nextAction.worry?.dateKey).toBe("2026-10-13");
    expect(view.ctaState).toBe("customsCleared");
  });

  test("handed to carrier without a pickup event", () => {
    const view = deriveTrackingView(success(handedToCarrierData()), PICKUP_NOW, CONFIG);
    expect(view.title).toBe("택배사에 넘어갔어요");
    expect(view.reason).toBe("CJ대한통운에서 배송을 준비하고 있어요.");
  });

  test("errors: inquiry first, no stores, no ETA, no spine marker, number-free document title", () => {
    for (const cause of ALL_CAUSES) {
      const view = deriveTrackingView(failure(cause), FIXTURE_NOW, CONFIG);
      expect(view.mode, cause).toBe("error");
      expect(view.ctaState, cause).toBe("error");
      expect(view.spine.current, cause).toBeNull();
      expect(view.eta, cause).toEqual({ kind: "none" });
      expect(view.nextAction.stores, cause).toBeNull();
      expect(view.revenue, cause).toEqual(NO_REVENUE);
      const firstLink = [view.nextAction.primary, ...view.nextAction.secondary].find((item) => item !== null && item.href !== null);
      expect(firstLink?.href, cause).toBe(CONFIG.channels.talk.url);
      expect(/\d/.test(view.documentTitle), cause).toBe(false);
      expect(view.documentTitle.endsWith(" · 배송 조회"), cause).toBe(true);
    }
  });

  test("broken event times never leak into the view", () => {
    const data = customsWaitingData();
    const broken: TrackResponseData = {
      ...data,
      customs: { events: [ev("알 수 없음", 2, "not-a-date"), ...[...data.customs.events].reverse(), ev("빈 시각", 1, "")] }
    };
    const view = deriveTrackingView(success(broken), FIXTURE_NOW, CONFIG);
    expect(JSON.stringify(view)).not.toMatch(/Invalid Date|NaN|undefined/);
    expect(view.history.count).toBe(2);
    expect(view.lastEvent?.label).toBe("통관 접수");
    expect(view.nextAction.worry?.dateKey).toBe("2026-09-28");
  });
});

test.describe("result views in America/New_York", () => {
  let previousTz: string | undefined;

  test.beforeAll(() => {
    previousTz = process.env.TZ;
    process.env.TZ = "America/New_York";
  });

  test.afterAll(() => {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });

  test("the whole view model equals the one computed in the default time zone", () => {
    expect(deriveTrackingView(success(customsWaitingData()), FIXTURE_NOW, CONFIG)).toEqual(BASELINE_WAITING);
    expect(deriveTrackingView(success(inTransitData()), OCTOBER_NOW, CONFIG)).toEqual(BASELINE_IN_TRANSIT);
    expect(deriveTrackingView(success(customsWaitingData()), at("2026-09-29T00:00:00+09:00"), CONFIG)).toEqual(BASELINE_OVERDUE);
  });
});

test.describe("error views by cause", () => {
  const withCaveat = withConfig({ lookup: { notFoundServiceCaveat: true } });
  const withoutCaveat = withConfig({ lookup: { notFoundServiceCaveat: false } });

  test("NOT_FOUND: fix the number first, 톡톡 as the first link, 7-day worry line, caveat line before R4", () => {
    const view = deriveTrackingView(failure("notFound"), FIXTURE_NOW, withCaveat);
    expect(view.guideKey).toBe("notFound");
    expect(view.tone).toBe("attention");
    expect(view.chip).toBe("조회 결과 없음");
    expect(view.title).toBe("아직 조회되는 정보가 없어요");
    expect(view.nextAction.heading).toBe("조회가 잘되지 않나요?");
    expect(view.nextAction.primary).toEqual({ kind: "fixNumber", label: "번호 수정", weight: "primary", href: null, external: false, cooldownSeconds: null });
    expect(view.nextAction.secondary).toEqual([
      TALK_SECONDARY, { kind: "copyReturnLink", label: "다시 볼 링크 복사", weight: "text", href: null, external: false, cooldownSeconds: null }
    ]);
    expect(view.nextAction.worry).toEqual({ dateKey: null, text: "출고 안내를 받은 지 7일이 지나도 조회되지 않으면 번호를 보내 주세요", talk: TALK_TEXT });
    expect(view.auxiliaryLine).toEqual({ text: "조회 서비스 사정으로 결과가 없을 수도 있어요", action: RETRY_TEXT });
    expect(view.retry).toEqual({ cooldownSeconds: null, autoRetryWhenOnline: false, escalated: false });
    expect(view.help.map((item) => item.id)).toEqual(["pre-arrival", "order-check"]);
    expect(view.inquiryCopy).toBeNull();
  });

  test("NOT_FOUND after the R4 server fix: no caveat line, 다시 조회 moves into the CTA block", () => {
    const view = deriveTrackingView(failure("notFound"), FIXTURE_NOW, withoutCaveat);
    expect(view.auxiliaryLine).toBeNull();
    expect(view.nextAction.secondary).toEqual([TALK_SECONDARY, RETRY_TEXT]);
  });

  test("429: the reason becomes the countdown sentence and 다시 조회 waits 10 s", () => {
    const view = deriveTrackingView(failure("rateLimited"), FIXTURE_NOW, withConfig({ lookup: { rateLimitCooldownSeconds: 10 } }));
    expect(view.guideKey).toBe("temporaryDelay");
    expect(view.title).toBe("조회가 잠시 지연되고 있어요");
    expect(view.reason).toBe("조회가 몰려 10초 뒤 다시 조회할 수 있어요");
    expect(view.nextAction.primary).toEqual({ kind: "retry", label: "다시 조회", weight: "primary", href: null, external: false, cooldownSeconds: 10 });
    expect(view.retry).toEqual({ cooldownSeconds: 10, autoRetryWhenOnline: false, escalated: false });
  });

  test("503/504 with a chosen carrier: retry first, 톡톡, then the carrier's official lookup", () => {
    const view = deriveTrackingView(failure("upstreamTimeout", { carrier: "CJ" }), FIXTURE_NOW, CONFIG);
    expect(view.reason).toBe("번호 문제는 아니에요.");
    expect(view.carrier.barLabel).toBe("CJ대한통운");
    expect(view.nextAction.primary?.kind).toBe("retry");
    expect(view.nextAction.secondary).toEqual([
      TALK_SECONDARY,
      { kind: "carrierOfficial", label: "CJ대한통운 공식 배송조회", weight: "text", href: carrierOfficialUrl("CJ", FAKE.domestic), external: true, cooldownSeconds: null }
    ]);
    expect(view.returnLink).toBe(buildReturnLink(FAKE.domestic, "CJ"));
  });

  test("offline: one automatic re-lookup when the connection returns", () => {
    const view = deriveTrackingView(failure("offline"), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("offline");
    expect(view.title).toBe("인터넷 연결이 끊겼어요");
    expect(view.retry).toEqual({ cooldownSeconds: null, autoRetryWhenOnline: true, escalated: false });
  });

  test("client timeout: no '번호 문제는 아니에요'; retry first, 번호 수정 as a secondary", () => {
    const view = deriveTrackingView(failure("clientTimeout"), FIXTURE_NOW, CONFIG);
    expect(view.guideKey).toBe("noResponse");
    expect(view.title).toBe("응답이 너무 오래 걸려 조회를 멈췄어요");
    expect(view.reason).not.toContain("번호 문제는 아니에요");
    expect(view.nextAction.primary?.kind).toBe("retry");
    expect(view.nextAction.secondary).toEqual([
      TALK_SECONDARY, { kind: "fixNumber", label: "번호 수정", weight: "secondary", href: null, external: false, cooldownSeconds: null }
    ]);
    // Spec §16 item 3 names [번호 수정] for 응답 없음: a fixNumber row swaps the two recovery actions, never duplicates one.
    const fixFirst = deriveTrackingView(failure("clientTimeout"), FIXTURE_NOW, withConfig({ stateGuide: { noResponse: { primaryAction: "fixNumber" } } }));
    expect(fixFirst.nextAction.primary?.kind).toBe("fixNumber");
    expect(fixFirst.nextAction.secondary).toEqual([TALK_SECONDARY, RETRY_SECONDARY]);
  });

  test("500 and contract violation: red tone, copy-and-talk primary with a screen-error inquiry text", () => {
    for (const cause of ["serverError", "contractViolation"] as const) {
      const view = deriveTrackingView(failure(cause), FIXTURE_NOW, CONFIG);
      expect(view.guideKey, cause).toBe("serverError");
      expect(view.tone, cause).toBe("problem");
      expect(view.nextAction.primary, cause).toEqual(COPY_AND_TALK);
      expect(view.nextAction.secondary, cause).toEqual([RETRY_SECONDARY]);
      expect(view.inquiryCopy, cause).toBe(`[배송 문의] 조회번호 ${FAKE_GROUPED.domestic} / 조회 화면 오류 / 9월 26일 14:05`);
      expect(view.inquiryLevel, cause).toBe("primary");
    }
  });

  test("two failures in a row raise 톡톡 to the primary button; invalid numbers never escalate", () => {
    const delay = deriveTrackingView(failure("network", { consecutiveFailures: 2 }), FIXTURE_NOW, CONFIG);
    expect(delay.nextAction.primary).toEqual(COPY_AND_TALK);
    expect(delay.nextAction.secondary).toEqual([RETRY_SECONDARY]);
    expect(delay.retry?.escalated).toBe(true);
    expect(delay.inquiryLevel).toBe("primary");
    expect(delay.inquiryCopy).toBe(`[배송 문의] 조회번호 ${FAKE_GROUPED.domestic} / 조회 화면 오류 / 9월 26일 14:05`);
    const notFound = deriveTrackingView(failure("notFound", { consecutiveFailures: 2 }), FIXTURE_NOW, CONFIG);
    expect(notFound.nextAction.secondary.map((item) => [item.kind, item.weight])).toEqual([["fixNumber", "secondary"]]);
    const invalid = deriveTrackingView(failure("invalidNumber", { consecutiveFailures: 3 }), FIXTURE_NOW, CONFIG);
    expect(invalid.retry?.escalated).toBe(false);
    expect(invalid.nextAction.primary?.kind).toBe("fixNumber");
  });

  test("invalid number: the input error sentence and 톡톡 as the only link", () => {
    const view = deriveTrackingView(failure("invalidNumber"), FIXTURE_NOW, CONFIG);
    expect(view.title).toBe("번호 형식이 달라요. 숫자 10~14자리 또는 영문 3~4자+숫자예요.");
    expect(view.chip).toBe("번호 확인");
    expect(view.carrier.barLabel).toBe("택배사");
    expect(view.nextAction.secondary).toEqual([TALK_SECONDARY]);
  });

  test("an outage notice explains a delay; holiday notices never show on error screens", () => {
    expect(deriveTrackingView(failure("upstreamTimeout"), at("2026-09-26T22:30:00+09:00"), CONFIG).notice?.id).toBe("fx-outage");
    expect(deriveTrackingView(failure("upstreamTimeout"), FIXTURE_NOW, CONFIG).notice).toBeNull();
  });

  test("a copyAndTalk error row makes 톡톡 the filled primary and the recovery action a secondary", () => {
    const fallback = withConfig({ stateGuide: { notFound: { primaryAction: "copyAndTalk", inquiryLevel: "primary" } } });
    const view = deriveTrackingView(failure("notFound"), FIXTURE_NOW, fallback);
    expect(view.nextAction.primary).toEqual(COPY_AND_TALK);
    expect(view.nextAction.secondary.map((item) => [item.kind, item.weight])).toEqual([["fixNumber", "secondary"]]);
  });
});

test.describe("GAP3-06: 12 state variants and the 5 API error codes show 0 contradictions", () => {
  test("each variant maps to its state", () => {
    for (const state of GAP3_06_VARIANTS) {
      expect(deriveTrackingView(success(trackData(state)), FIXTURE_NOW, CONFIG).guideKey, state).toBe(GAP3_06_KEYS[state]);
    }
  });

  test("0 contradictions across the 12 variants and the 5 error codes", () => {
    const views = [
      ...GAP3_06_VARIANTS.map((state) => deriveTrackingView(success(trackData(state)), FIXTURE_NOW, CONFIG)),
      ...ERROR_CODE_INPUTS.map((input) => deriveTrackingView(failure(classifyFailure(input)), FIXTURE_NOW, CONFIG))
    ];
    expect(views).toHaveLength(17);
    expect(views.flatMap(contradictions)).toEqual([]);
  });

  test("0 contradictions for the explicit scenarios, their overdue forms and every failure cause", () => {
    const septemberData = [
      customsArrivedData(), customsWaitingData(), customsReviewData(), customsClearedData(), carrierCutData(), pendingData(),
      deliveredData(), staleData(), lookupUnavailableData("AUTO"), lookupUnavailableData("CJ"), ambiguousData()
    ];
    const views = [
      ...septemberData.map((data) => deriveTrackingView(success(data), FIXTURE_NOW, CONFIG)),
      deriveTrackingView(success(pickedUpData()), PICKUP_NOW, CONFIG),
      deriveTrackingView(success(handedToCarrierData()), PICKUP_NOW, CONFIG),
      BASELINE_IN_TRANSIT,
      BASELINE_OVERDUE,
      deriveTrackingView(success(inTransitData()), at("2026-10-16T00:00:00+09:00"), CONFIG),
      deriveTrackingView(success(customsClearedData()), at("2026-09-30T09:00:00+09:00"), CONFIG),
      ...ALL_CAUSES.map((cause) => deriveTrackingView(failure(cause), FIXTURE_NOW, CONFIG)),
      ...ALL_CAUSES.map((cause) => deriveTrackingView(failure(cause, { consecutiveFailures: 2 }), FIXTURE_NOW, CONFIG))
    ];
    expect(views.flatMap(contradictions)).toEqual([]);
  });
});

test("a cleared shipment without customs events (a domestic lookup) still shows the clearance date from the estimate", () => {
  const data: TrackResponseData = { ...pickedUpData(), customs: { events: [] } };
  const view = deriveTrackingView(success(data), PICKUP_NOW, CONFIG);
  const estimate = data.estimatedCustomsClearanceDate;
  if (estimate === undefined) throw new Error("fixture has no customs estimate");
  const expected = CONFIG.resultCopy.customsDoneCaption.replace("{date}", formatKstDate(new Date(estimate)));
  expect(view.eta.kind === "date" || view.eta.kind === "today" || view.eta.kind === "holidayAffected").toBe(true);
  expect("caption" in view.eta ? view.eta.caption : null).toBe(expected);
});
