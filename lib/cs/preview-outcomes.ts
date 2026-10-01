import { normalizeTrackingData } from "@/lib/services/normalizer";
import type { FailureCause, GuideKey, LookupOutcome, LookupRequest } from "@/lib/tracking/types";
import type { DeliveryLookupResult, StatusCode, TrackingEvent, TrackingType } from "@/lib/types";

// Internal-only (contract §11.1 rule 4). Fake outcomes for every result state (spec §10 ③ 안내표 미리보기): only the fake
// numbers 0000 0000 0001 and TEST 0000 0001 appear (spec §4), and every event sits relative to `now`, so the preview
// shows the same states on any day. Success data goes through the real normalizer, like an /api/track answer.

export const PREVIEW_NUMBERS = { domestic: "000000000001", hbl: "TEST00000001", invalid: "00001" } as const;
/** The repo guard's fake mobile form (010-0000-dddd). */
export const PREVIEW_DRIVER_PHONE = "010-0000-1234";
/** The overdue preview's events happened this many days before `now`; worry dates fall at most about a week later. */
export const PREVIEW_OVERDUE_AGE_DAYS = 10;

export const PREVIEW_SCENARIO_IDS = [
  "pending",
  "customsArrived",
  "customsWaiting",
  "customsWaitingOverdue",
  "customsCleared",
  "customsClearedCarrierCut",
  "handedToCarrier",
  "pickedUp",
  "inTransit",
  "delivered",
  "stale",
  "lookupUnavailable",
  "ambiguous",
  "invalidNumber",
  "notFound",
  "temporaryDelay",
  "offline",
  "noResponse",
  "serverError"
] as const;
export type PreviewScenarioId = (typeof PREVIEW_SCENARIO_IDS)[number];

export interface PreviewScenario {
  readonly id: PreviewScenarioId;
  /** Staff-facing heading in the preview tab. */
  readonly label: string;
  /** The state this scenario must derive to (tests/unit/preview-outcomes.spec.ts checks it on every day). */
  readonly guideKey: GuideKey;
  readonly overdue: boolean;
  readonly outcome: LookupOutcome;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const STALE_START_HOURS = -21 * 24;
const STALE_LAST_HOURS = -20 * 24;

const AUTO_LOOKUP: DeliveryLookupResult = { carrier: "택배사 자동 확인", carrierCode: "AUTO", events: [] };

function cjLookup(events: readonly TrackingEvent[], lookupUnavailable = false): DeliveryLookupResult {
  return { carrier: "CJ대한통운", carrierCode: "CJ", events: [...events], ...(lookupUnavailable ? { lookupUnavailable: true } : {}) };
}

/** The ISO instant `hours` after `anchor` (negative = before). */
function at(anchor: Date, hours: number): string {
  return new Date(anchor.getTime() + hours * HOUR_MS).toISOString();
}

function ev(status: string, statusCode: StatusCode, datetime: string, location: string, extra: Partial<TrackingEvent> = {}): TrackingEvent {
  return { status, statusCode, datetime, location, ...extra };
}

interface SuccessRecipe {
  readonly kind: "success";
  readonly label: string;
  readonly guideKey: GuideKey;
  readonly type: TrackingType;
  readonly number: string;
  /** Days between the events and `now`; only the overdue variant sets it. */
  readonly ageDays?: number;
  readonly customs: (anchor: Date) => TrackingEvent[];
  readonly delivery: (anchor: Date) => DeliveryLookupResult;
}

interface FailureRecipe {
  readonly kind: "failure";
  readonly label: string;
  readonly guideKey: GuideKey;
  readonly number: string;
  readonly cause: FailureCause;
}

const noCustoms = (): TrackingEvent[] => [];
const autoLookup = (): DeliveryLookupResult => AUTO_LOOKUP;
const waitingEvents = (a: Date): TrackingEvent[] => [
  ev("입항", 1, at(a, -27), "인천공항"),
  ev("통관목록접수", 2, at(a, -3), "인천공항세관")
];
const clearedEvents = (a: Date): TrackingEvent[] => [
  ev("입항", 1, at(a, -50), "인천공항"),
  ev("통관목록접수", 2, at(a, -26), "인천공항세관"),
  ev("수입신고수리", 4, at(a, -3), "인천공항세관")
];
const clearedBeforeHandoff = (a: Date): TrackingEvent[] => [
  ev("통관목록접수", 2, at(a, -50), "인천공항세관"),
  ev("수입신고수리", 4, at(a, -26), "인천공항세관")
];

const domestic = { kind: "success", type: "DOMESTIC", number: PREVIEW_NUMBERS.domestic } as const;
const hbl = { kind: "success", type: "HBL", number: PREVIEW_NUMBERS.hbl } as const;

const RECIPES: Readonly<Record<PreviewScenarioId, SuccessRecipe | FailureRecipe>> = {
  pending: { ...domestic, label: "국내 도착 전", guideKey: "pending", customs: noCustoms, delivery: autoLookup },
  customsArrived: {
    ...hbl,
    label: "입항 · 통관 준비",
    guideKey: "customsArrived",
    customs: (a) => [ev("입항", 1, at(a, -3), "인천공항")],
    delivery: autoLookup
  },
  customsWaiting: { ...hbl, label: "통관 대기", guideKey: "customsWaiting", customs: waitingEvents, delivery: autoLookup },
  customsWaitingOverdue: {
    ...hbl,
    label: "통관 대기 · 걱정 기준일 지남",
    guideKey: "customsWaiting",
    ageDays: PREVIEW_OVERDUE_AGE_DAYS,
    customs: waitingEvents,
    delivery: autoLookup
  },
  customsCleared: { ...domestic, label: "통관 완료", guideKey: "customsCleared", customs: clearedEvents, delivery: autoLookup },
  customsClearedCarrierCut: {
    ...domestic,
    label: "통관 완료 · 택배사 조회 지연",
    guideKey: "customsCleared",
    customs: clearedEvents,
    delivery: () => cjLookup([], true)
  },
  handedToCarrier: {
    ...domestic,
    label: "택배사 인계",
    guideKey: "handedToCarrier",
    customs: clearedBeforeHandoff,
    delivery: (a) => cjLookup([ev("간선상차", 5, at(a, -3), "인천GW")])
  },
  pickedUp: {
    ...domestic,
    label: "기사님 픽업",
    guideKey: "pickedUp",
    customs: clearedBeforeHandoff,
    delivery: (a) => cjLookup([ev("집화처리", 5, at(a, -3), "인천GW")])
  },
  inTransit: {
    ...domestic,
    label: "국내 배송 중",
    guideKey: "inTransit",
    customs: (a) => [ev("통관목록접수", 2, at(a, -74), "인천공항세관"), ev("수입신고수리", 4, at(a, -50), "인천공항세관")],
    delivery: (a) =>
      cjLookup([
        ev("집화처리", 5, at(a, -26), "인천GW"),
        ev("배송출발", 6, at(a, -3), "서울강남", { driverPhone: PREVIEW_DRIVER_PHONE })
      ])
  },
  delivered: {
    ...domestic,
    label: "배송 완료",
    guideKey: "delivered",
    customs: (a) => [ev("수입신고수리", 4, at(a, -74), "인천공항세관")],
    delivery: (a) =>
      cjLookup([
        ev("집화처리", 5, at(a, -50), "인천GW"),
        ev("배송출발", 6, at(a, -8), "서울강남"),
        ev("배송완료", 7, at(a, -3), "문 앞")
      ])
  },
  stale: {
    ...domestic,
    label: "장기 정체",
    guideKey: "stale",
    customs: (a) => [
      ev("통관목록접수", 2, at(a, STALE_START_HOURS), "인천공항세관"),
      ev("통관목록심사", 3, at(a, STALE_LAST_HOURS), "인천공항세관")
    ],
    delivery: autoLookup
  },
  lookupUnavailable: {
    ...domestic,
    label: "택배사 조회 지연",
    guideKey: "lookupUnavailable",
    customs: noCustoms,
    delivery: () => ({ ...AUTO_LOOKUP, lookupUnavailable: true })
  },
  ambiguous: {
    ...domestic,
    label: "여러 택배사에 같은 번호",
    guideKey: "ambiguous",
    customs: noCustoms,
    delivery: () => ({ ...AUTO_LOOKUP, ambiguous: true })
  },
  invalidNumber: { kind: "failure", label: "번호 형식 오류", guideKey: "invalidNumber", number: PREVIEW_NUMBERS.invalid, cause: "invalidNumber" },
  notFound: { kind: "failure", label: "조회 결과 없음", guideKey: "notFound", number: PREVIEW_NUMBERS.hbl, cause: "notFound" },
  temporaryDelay: { kind: "failure", label: "일시 지연", guideKey: "temporaryDelay", number: PREVIEW_NUMBERS.domestic, cause: "upstreamTimeout" },
  offline: { kind: "failure", label: "인터넷 연결 끊김", guideKey: "offline", number: PREVIEW_NUMBERS.domestic, cause: "offline" },
  noResponse: { kind: "failure", label: "응답 없음", guideKey: "noResponse", number: PREVIEW_NUMBERS.hbl, cause: "clientTimeout" },
  serverError: { kind: "failure", label: "조회 오류", guideKey: "serverError", number: PREVIEW_NUMBERS.domestic, cause: "serverError" }
};

function request(number: string): LookupRequest {
  return { number, carrier: "AUTO", entry: "manual" };
}

export function buildPreviewScenario(id: PreviewScenarioId, now: Date): PreviewScenario {
  const recipe = RECIPES[id];
  if (recipe.kind === "failure") {
    return {
      id,
      label: recipe.label,
      guideKey: recipe.guideKey,
      overdue: false,
      outcome: { kind: "failure", request: request(recipe.number), cause: recipe.cause, consecutiveFailures: 1 }
    };
  }
  const anchor = new Date(now.getTime() - (recipe.ageDays ?? 0) * DAY_MS);
  const data = normalizeTrackingData({
    trackingNumber: recipe.number,
    type: recipe.type,
    customsEvents: recipe.customs(anchor),
    deliveryLookup: recipe.delivery(anchor),
    now: anchor
  });
  return {
    id,
    label: recipe.label,
    guideKey: recipe.guideKey,
    overdue: recipe.ageDays !== undefined,
    outcome: { kind: "success", request: request(recipe.number), data }
  };
}

export function buildPreviewScenarios(now: Date): readonly PreviewScenario[] {
  return PREVIEW_SCENARIO_IDS.map((id) => buildPreviewScenario(id, now));
}
