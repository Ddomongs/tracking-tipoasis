import type { ApiError, DeliveryCarrierCode, TrackResponseData } from "@/lib/types";

export const GUIDE_KEYS = [
  "idle", "loading",
  "invalidNumber", "notFound", "temporaryDelay", "offline", "noResponse", "serverError",
  "pending", "customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp",
  "inTransit", "delivered", "stale", "lookupUnavailable", "ambiguous"
] as const;
export type GuideKey = (typeof GUIDE_KEYS)[number];

export const ERROR_GUIDE_KEYS = ["invalidNumber", "notFound", "temporaryDelay", "offline", "noResponse", "serverError"] as const;
export const PROBLEM_GUIDE_KEYS = [...ERROR_GUIDE_KEYS, "stale", "lookupUnavailable", "ambiguous"] as const;
export const OVERDUE_CAPABLE_KEYS = ["customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp", "inTransit"] as const;

export type Tone = "neutral" | "progress" | "waiting" | "attention" | "problem" | "done";
export type StatusTone = Exclude<Tone, "neutral">;
export type InquiryLevel = "header" | "shortcutRow" | "blockFirstLink" | "ctaButton" | "worryLink" | "textLink" | "afterStores" | "primary";
export type RevenueTier = "none" | "quiet" | "lead";
export type StorePlacement = "none" | "shortcutRow" | "purchaseChoices" | "ctaLead";
export type StorePlacementId = "shortcut" | "showcase" | "pending" | "deliveredLead";
export type TalkPlacement = "header" | "shortcut" | "state" | "footer";
export type RecommendationPlacement = "none" | "optional" | "inline";
export type RecommendationContext = "pending" | "customsWaiting" | "customsCleared" | "inTransit" | "delivered";
export type EtaMode = "none" | "estimate" | "pendingInfo" | "withheld" | "deliveredOn";
export type PrimaryActionKind = "none" | "submit" | "fixNumber" | "retry" | "copyAndTalk" | "carrierOfficial" | "chooseCarrier" | "storeLead";
export type CtaState = "error" | "pending" | "customsWaiting" | "customsCleared" | "inTransit" | "delivered" | "stale" | "lookupUnavailable" | "ambiguous";
export type StationId = "departed" | "customs" | "domestic" | "arrived";
export type SpineIssue = "stopped" | "cut" | "branch";
export type ViewMode = "idle" | "loading" | "settled" | "error";
export type LookupEntry = "manual" | "deepLink" | "restore" | "carrierChip" | "retry" | "autoRetryOnline";
export type ConcreteCarrierCode = Exclude<DeliveryCarrierCode, "AUTO">;
export type ApiErrorCode = ApiError["code"];
export type InvalidReason = "empty" | "tooShort" | "tooLong" | "confusableLetter" | "badFormat";
export type NoticeKind = "outage" | "delay" | "holiday" | "info";

export type FailureCause =
  | "invalidNumber"      // client pre-check, HTTP 400/413/415, invalid deep link
  | "notFound"           // HTTP 404 with JSON code NOT_FOUND
  | "rateLimited"        // HTTP 429
  | "upstreamTimeout"    // HTTP 503/504 (JSON API_TIMEOUT) and 408
  | "badGateway"         // any non-JSON response (e.g. HTML 502/404)
  | "network"            // fetch TypeError while navigator.onLine === true
  | "offline"            // fetch TypeError while navigator.onLine === false
  | "clientTimeout"      // our AbortController timeout fired
  | "serverError"        // HTTP 500 JSON SERVER_ERROR and any other JSON non-2xx not listed above
  | "contractViolation"; // HTTP 200 whose body fails ApiTrackResponseSchema

export type FailureInput =
  | { readonly kind: "precheck"; readonly reason: InvalidReason }
  | { readonly kind: "http"; readonly status: number; readonly code: string | null; readonly isJson: boolean }
  | { readonly kind: "contract" }
  | { readonly kind: "network"; readonly online: boolean }
  | { readonly kind: "timeout" };

export interface LookupRequest {
  readonly number: string;               // normalized: uppercase, no spaces/hyphens, half-width digits
  readonly carrier: DeliveryCarrierCode; // "AUTO" when not chosen
  readonly entry: LookupEntry;
}

export type LookupOutcome =
  | { readonly kind: "success"; readonly request: LookupRequest; readonly data: TrackResponseData }
  | { readonly kind: "failure"; readonly request: LookupRequest; readonly cause: FailureCause; readonly consecutiveFailures: number };

export type TrackingEntry =
  | { readonly kind: "home" }
  | { readonly kind: "deepLink"; readonly number: string; readonly carrier: DeliveryCarrierCode }
  | { readonly kind: "invalidDeepLink"; readonly input: string };

// ---------- view model ----------
export interface NumberView { readonly raw: string; readonly grouped: string }

export interface CarrierView {
  readonly code: DeliveryCarrierCode;
  readonly name: string | null;        // null when unknown; the internal label '택배사 자동 확인' is never a name
  readonly barLabel: string;           // number-bar suffix: carrier name | '택배사 자동 확인' (loading only) | '택배사 배정 전' | '택배사'
  readonly officialUrl: string | null; // delivery.trackingUrl or getDeliveryCarrier(code).trackingUrl(number) when code !== "AUTO"
}

export interface SpineView {
  readonly current: StationId | null;  // null = 위치 확인 전: 0 markers, no aria-current
  readonly issue: { readonly at: StationId; readonly kind: SpineIssue; readonly label: string } | null; // label '멈춤' | '끊김' | '갈림'
  readonly handoffPending: boolean;    // code 4: customs station done + '인계 대기'
  readonly positionLabel: string | null; // '2/4'; null when current is null
}

export interface EtaDate {
  readonly key: string;     // 'YYYY-MM-DD' in KST
  readonly label: string;   // '9월 30일 (수)'
  readonly month: number;   // 9
  readonly day: number;     // 30
  readonly weekday: string; // '수'
}

export type EtaView =
  | { readonly kind: "none" }
  | { readonly kind: "date"; readonly label: string; readonly date: EtaDate; readonly dday: number; readonly caption: string | null }
  | { readonly kind: "today"; readonly label: string; readonly date: EtaDate; readonly caption: string | null }
  | { readonly kind: "holidayAffected"; readonly label: string; readonly date: EtaDate; readonly badge: string; readonly holidayName: string; readonly caption: string | null }
  | { readonly kind: "overdue"; readonly label: string; readonly date: EtaDate }        // label '예상했던 날짜'
  | { readonly kind: "deliveredOn"; readonly label: string; readonly date: EtaDate }    // label '배송 완료일'
  | { readonly kind: "pendingInfo"; readonly label: string; readonly text: string }     // text '정보 등록 후 안내'
  | { readonly kind: "withheld"; readonly label: string; readonly text: string }        // text '지금은 도착 예상일을 안내하기 어려워요'
  | { readonly kind: "unknown"; readonly label: string; readonly text: string };        // estimate missing
export type EtaKind = EtaView["kind"];

export type ActionKind =
  | "fixNumber" | "retry" | "cancel" | "copyAndTalk" | "copyInquiry" | "talk"
  | "carrierOfficial" | "callDriver" | "callCarrier" | "copyReturnLink" | "chooseCarrier" | "undeliveredHelp";
export type ActionWeight = "primary" | "secondary" | "text";
export interface ActionView {
  readonly kind: ActionKind;
  readonly label: string;
  readonly weight: ActionWeight;
  readonly href: string | null;            // external or tel: link; null for in-page actions
  readonly external: boolean;              // new tab
  readonly cooldownSeconds: number | null; // 429: enabled after this many seconds
  /** Phone actions only (10월 2일 요청): the number shown on the button — a driver's is masked ('010-****-5678'). */
  readonly detail?: string;
}

export interface WorryLineView {
  readonly dateKey: string | null; // 'YYYY-MM-DD' when date-based; null for notFound/pending day counts
  readonly text: string;           // '9월 29일(화)까지 그대로면 알려 주세요'
  readonly talk: ActionView;       // weight "text"
}

export interface StoreLinkView {
  readonly channel: "naver" | "coupang";
  readonly label: string;          // '네이버 스토어 보기' | '쿠팡 스토어 보기'
  readonly href: string;           // placement-specific URL from config.channels
  readonly isAffiliate: boolean;
  readonly weight: ActionWeight;
}
export interface StoreLinksView {
  readonly placement: StorePlacementId;
  readonly intro: string | null;       // pending: '주문하신 곳에서도 배송 안내를 볼 수 있어요'
  readonly disclosure: string | null;  // non-null iff some link isAffiliate
  readonly links: readonly StoreLinkView[];
}

export interface CarrierChoiceView { readonly code: ConcreteCarrierCode; readonly name: string }

export interface NextActionView {
  readonly heading: string | null;              // h3
  readonly sentence: string;
  readonly primary: ActionView | null;          // at most one filled action
  readonly secondary: readonly ActionView[];    // 0–2
  readonly worry: WorryLineView | null;
  readonly stores: StoreLinksView | null;
  readonly carrierChoices: readonly CarrierChoiceView[] | null; // ambiguous; lookupUnavailable without officialUrl
  readonly note: string | null;
  /** Delivered only (10월 2일 요청): whom to call when the parcel is missing — the driver, else the carrier's center. */
  readonly contact?: ActionView;
}

export interface NoticeView { readonly id: string; readonly kind: NoticeKind; readonly title: string; readonly body: string }

export interface LastEventView {
  readonly at: string;              // ISO instant
  readonly label: string;           // glossary label '통관 접수'
  readonly original: string | null; // '통관목록접수' when different from label
  readonly place: string | null;
  readonly text: string;            // '9월 23일 (수) 14:10 · 통관 접수'
}
export interface HistoryEventView {
  readonly at: string; readonly timeText: string; readonly label: string; readonly original: string | null; readonly place: string | null;
}
export interface HistorySegmentView { readonly station: StationId; readonly title: string; readonly events: readonly HistoryEventView[] }
export interface HistoryView {
  readonly count: number;
  readonly summaryText: string;      // '처리 내역 11건 보기 · 마지막 9월 23일 14:10'
  readonly emptyText: string | null; // '아직 처리 내역이 없어요' when count === 0
  readonly segments: readonly HistorySegmentView[];
  readonly recent: readonly HistoryEventView[]; // newest 3 (desktop side column)
}

export interface HelpItemView { readonly id: string; readonly summary: string; readonly body: readonly string[]; readonly defaultOpen: boolean }
export interface RetryView { readonly cooldownSeconds: number | null; readonly autoRetryWhenOnline: boolean; readonly escalated: boolean }
export interface RevenueView {
  readonly tier: RevenueTier;
  readonly stores: StorePlacement;
  readonly recommendations: RecommendationPlacement;
  readonly recommendationContext: RecommendationContext | null;
  readonly adsAllowed: boolean;      // tier !== "none" && !overdue && mode === "settled"
}

export interface TrackingViewModel {
  readonly guideKey: GuideKey;
  readonly mode: "settled" | "error";
  readonly tone: Tone;               // after the overdue override
  readonly overdue: boolean;
  readonly number: NumberView;
  readonly carrier: CarrierView;
  readonly chip: string | null;      // '통관 대기 · 2/4', '확인 필요 · 2/4', '국내 도착 전', '조회 오류', '도착 · 4/4'
  readonly title: string;            // status h2, tokens resolved
  readonly reason: string | null;
  readonly notice: NoticeView | null;// in-card '안내' line
  readonly spine: SpineView;
  readonly eta: EtaView;
  readonly nextAction: NextActionView;
  readonly lastEvent: LastEventView | null;
  readonly history: HistoryView;
  readonly ctaState: CtaState;
  readonly inquiryLevel: InquiryLevel;
  readonly revenue: RevenueView;
  readonly retry: RetryView | null;  // error modes only
  readonly auxiliaryLine: { readonly text: string; readonly action: ActionView | null } | null; // NOT_FOUND caveat; '택배사 조회가 잠시 늦어요' + [다시 조회]
  readonly help: readonly HelpItemView[];
  readonly inquiryCopy: string | null; // non-null when a copyAndTalk/copyInquiry action exists
  readonly returnLink: string;         // buildReturnLink(number.raw, carrier.code)
  readonly documentTitle: string;      // `${row.docTitle} · 배송 조회`, never contains the number
  readonly liveMessage: string;        // one sentence for the live region
}

export type LoadingStage = "instant" | "short" | "long" | "veryLong"; // [0,400ms) [400ms,3s) [3s,8s) [8s,timeout)
export interface LoadingViewModel {
  readonly stage: LoadingStage;
  readonly number: NumberView;
  readonly carrier: CarrierView;
  readonly title: string;               // '조회하고 있어요'
  readonly body: string;                // '관세청 통관 정보와 택배사 배송 정보를 함께 확인해요'
  readonly extra: string | null;        // 3 s / 8 s copy
  readonly elapsedText: string | null;  // '12초째' from 8 s, 5 s steps
  readonly cancel: ActionView | null;   // from 3 s
  readonly carrierOfficial: ActionView | null; // from 8 s when carrier !== "AUTO"
  readonly spinnerActive: boolean;      // false from 5 s or with reduced motion
  readonly announcement: string | null; // '조회를 시작했어요' on entering "short"; the 8 s sentence on entering "veryLong"
  readonly submitLabel: string;         // '조회 중…'
  readonly outageNotice: NoticeView | null;
}

export type ResultAction =
  | { readonly kind: "fixNumber" }
  | { readonly kind: "retry" }
  | { readonly kind: "cancel" }
  | { readonly kind: "chooseCarrier"; readonly carrier: ConcreteCarrierCode }
  | { readonly kind: "copied"; readonly what: "inquiry" | "returnLink"; readonly outcome: "copied" | "fallback" } // same union as CopyOutcome in lib/clipboard.ts (S03 must not import S02 modules)
  | { readonly kind: "openedExternal"; readonly target: "talk" | "carrier" | "store" | "driver" };
