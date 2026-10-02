import type {
  EtaMode, GuideKey, InquiryLevel, NoticeKind, PrimaryActionKind, RecommendationContext, RecommendationPlacement,
  RevenueTier, StationId, StorePlacement, StorePlacementId, Tone
} from "@/lib/tracking/types";

export type ChannelId = "talk" | "naver" | "coupang";
export type StoreChannelId = Exclude<ChannelId, "talk">;

export interface TalkChannel {
  readonly url: string; // https only
  readonly labels: {
    readonly header: string;      // '문의'
    readonly shortcut: string;    // '톡톡 상담'
    readonly cta: string;         // '톡톡으로 문의하기'
    readonly copyAndTalk: string; // '문의 내용 복사하고 톡톡 열기'
    readonly footer: string;      // '톡톡 상담'
  };
}
export interface StoreChannel {
  readonly name: string;       // '네이버 스토어' | '쿠팡 스토어'
  readonly linkLabel: string;  // '네이버 스토어 보기' | '쿠팡 스토어 보기'
  readonly isAffiliate: boolean; // naver false, coupang true
  readonly urls: Readonly<Record<StorePlacementId, string>>; // per-placement link ids for partner dashboards
}
/** The operator's YouTube channel on the home store sheet; url null hides it. */
export interface YoutubeChannel {
  readonly linkLabel: string;
  readonly url: string | null;
}
export interface ChannelsConfig {
  readonly talk: TalkChannel;
  readonly naver: StoreChannel;
  readonly coupang: StoreChannel;
  readonly youtube: YoutubeChannel;
  readonly allowedHosts: readonly string[];
}
export interface DisclosuresConfig { readonly coupang: string }

export interface HolidayPeriod {
  readonly id: string;               // '2026-chuseok'
  readonly name: string;             // '추석 연휴'
  readonly dates: readonly string[]; // 'YYYY-MM-DD'
  readonly badge: string;            // '추석 연휴 영향 · 1~2일 늦어질 수 있어요'
}
export interface CalendarConfig {
  readonly timeZone: "Asia/Seoul";
  readonly holidays: readonly HolidayPeriod[];
  readonly carrierDeliversSaturday: boolean; // default false
}

export interface DayRange { readonly min: number; readonly max: number }
export interface DurationsConfig {
  readonly stages: {
    readonly visibleAfterDeparture: DayRange; // HBL searchable 3~7 days after departure
    readonly customs: DayRange;               // 1~2 days
    readonly handoffBusinessDays: DayRange;   // 0~1 business days
    readonly domestic: DayRange;              // 1~2 days
  };
  readonly typical: readonly { readonly station: StationId; readonly text: string }[]; // '보통 이렇게 걸려요'
  readonly worry: {
    readonly afterEstimateBusinessDays: number;  // 1
    readonly afterClearanceBusinessDays: number; // 2
    readonly notFoundDays: number;               // 7
    readonly pendingDays: number;                // 10
    readonly undeliveredHours: number;           // 24
  };
  readonly staleDays: number;        // must equal 14
  readonly pendingRecheck: string;   // approval 4
}

export interface LookupConfig {
  readonly skeletonDelayMs: number;            // 400
  readonly stageMs: readonly [number, number]; // [3000, 8000]
  readonly spinnerStopMs: number;              // 5000
  readonly elapsedStepSeconds: number;         // 5
  readonly timeoutMs: number;                  // 45000 until approval-5 deployment, then 25000
  readonly rateLimitCooldownSeconds: number;   // 10
  readonly notFoundServiceCaveat: boolean;     // true until approval-5 deployment
  readonly copy: {
    readonly submit: string;               // '조회하기'
    readonly submitting: string;           // '조회 중…'
    readonly title: string;                // '조회하고 있어요'
    readonly body: string;                 // '관세청 통관 정보와 택배사 배송 정보를 함께 확인해요'
    readonly started: string;              // '조회를 시작했어요'
    readonly longWait: string;             // 3 s sentence
    readonly veryLongWait: string;         // 8 s sentence
    readonly elapsed: string;              // '{seconds}초째'
    readonly cancel: string;               // '조회 취소'
    readonly carrierOfficialFirst: string; // '택배사 공식 조회로 먼저 보기'
    readonly formatHint: string;           // §11.11
    readonly numberFinderSummary: string;  // '번호는 어디서 찾나요?'
    readonly numberFinderItems: readonly string[]; // 네이버 주문상세 → 배송조회, 쿠팡 주문목록 → 배송조회, 톡톡 출고 안내문
    readonly carrierAuto: string;          // '택배사 자동 확인' (S03 addition: loading-only number-bar suffix)
    readonly typicalSummary: string;       // '보통 이렇게 걸려요' (S03 addition)
    readonly noscriptNotice: string;       // S06 addition: the deep-link shell's note when JavaScript is off
  };
}

export interface GuideRow {
  readonly tone: Tone;
  readonly chip: string | null;          // base chip text; derive appends ' · n/4'
  readonly docTitle: string;             // '통관 대기 중' (no tokens, no digits)
  readonly title: string;                // h2; tokens allowed
  readonly overdueTitle: string | null;  // non-null exactly for OVERDUE_CAPABLE_KEYS
  readonly reason: string | null;
  readonly ctaHeading: string | null;    // h3 of 지금 할 일
  readonly nextAction: string;
  readonly worry: string | null;         // tokens allowed ({worryDate})
  readonly primaryAction: PrimaryActionKind;
  readonly inquiryLevel: InquiryLevel;
  readonly revenueTier: RevenueTier;
  readonly stores: StorePlacement;
  readonly recommendations: RecommendationPlacement;
  readonly etaMode: EtaMode;
}

export interface GlossaryEntry { readonly source: string; readonly label: string } // '수입신고수리' → '통관 완료'
export interface HelpEntry {
  readonly id: string;
  readonly summary: string;
  readonly body: readonly string[];
  readonly showIn: readonly GuideKey[];
  readonly openIn: readonly GuideKey[];
}
export interface FeaturedItem {
  readonly id: string;
  readonly name: string;
  readonly channel: StoreChannelId;
  readonly href: string;                  // product detail https URL
  readonly isAffiliate: boolean;
  readonly validFrom: string;             // ISO with +09:00
  readonly validUntil: string;            // ISO with +09:00
  readonly priceLabel: string | null;
  readonly priceCheckedAt: string | null; // ISO; price shown only when within 7 days of now
  readonly contexts: readonly RecommendationContext[];
}
export interface Notice {
  readonly id: string;
  readonly kind: NoticeKind;
  readonly title: string;        // ≤ 20 chars
  readonly body: string;         // ≤ 80 chars
  readonly startsAt: string;     // ISO +09:00
  readonly endsAt: string;       // ISO +09:00, > startsAt
  readonly home: boolean;        // home banner
  readonly guideKeys: readonly GuideKey[]; // result in-card line
  readonly cs: boolean;          // appended to CS replies
}
export interface AdsConfig {
  readonly manualSlotId: string | null; // AdSense ad unit id (approval 15); null → slot not rendered
  readonly minHeightMobilePx: number;   // 280
  readonly minHeightDesktopPx: number;  // 250
  readonly anchorReservePx: number;     // 64; S08 verifies against a real anchor and amends the value
}
export interface StyleConfig { readonly followSystemDark: boolean } // default true

/** S03 addition: result copy the spec does not give per state. Slots per field are fixed in lib/config/invariants.ts. */
export interface ResultCopyConfig {
  readonly etaLabel: string;               // '도착 예상'
  readonly etaTodayLabel: string;          // '오늘 예상'
  readonly etaOverdueLabel: string;        // '예상했던 날짜'
  readonly etaDeliveredLabel: string;      // '배송 완료일'
  readonly etaPendingText: string;         // '정보 등록 후 안내'
  readonly etaWithheldText: string;        // '지금은 도착 예상일을 안내하기 어려워요'
  readonly etaUnknownText: string;         // estimate missing
  readonly customsEstimateCaption: string; // '통관 완료 예상 {date}'
  readonly customsDoneCaption: string;     // '통관 완료 {date}'
  readonly overdueChip: string;            // '확인 필요'
  readonly overdueSentence: string;        // 지금 할 일 sentence under overdue
  readonly carrierUnknown: string;         // '택배사'
  readonly carrierUnassigned: string;      // '택배사 배정 전'
  readonly issueStopped: string;           // '멈춤'
  readonly issueCut: string;               // '끊김'
  readonly issueBranch: string;            // '갈림'
  readonly stationDeparted: string;        // '해외 출발'
  readonly stationCustoms: string;         // '입항·통관'
  readonly stationDomestic: string;        // '국내 배송'
  readonly stationArrived: string;         // '도착'
  readonly historySummary: string;         // '처리 내역 {n}건 보기'
  readonly historyLast: string;            // '마지막 {time}'
  readonly historyEmpty: string;           // '아직 처리 내역이 없어요'
  readonly actionFixNumber: string;        // '번호 수정'
  readonly actionRetry: string;            // '다시 조회'
  readonly actionCarrierOfficial: string;  // '{carrier} 공식 배송조회'
  readonly actionCarrierLive: string;      // '{carrier}에서 실시간 위치 보기'
  readonly actionCallDriver: string;       // '기사님께 전화'
  readonly actionReturnLink: string;       // '다시 볼 링크 복사'
  readonly actionUndelivered: string;      // '받지 못하셨나요?'
  readonly pendingStoresIntro: string;     // '주문하신 곳에서도 배송 안내를 볼 수 있어요'
  readonly notFoundCaveat: string;         // '조회 서비스 사정으로 결과가 없을 수도 있어요'
  readonly carrierCutLine: string;         // '택배사 조회가 잠시 늦어요'
  readonly rateLimitedReason: string;      // '조회가 몰려 {seconds}초 뒤 다시 조회할 수 있어요'
  readonly customsCheckNote: string;       // '개인통관고유부호와 수취인 이름이 주문 정보와 같은지도 확인해 주세요'
  readonly chooseCarrierSentence: string;  // lookupUnavailable without an official link
  readonly returnLinkCopied: string;       // '링크를 복사했어요' (S07)
  readonly returnLinkShared: string;       // '링크를 공유했어요' (S07)
  readonly returnLinkFallback: string;     // '아래 링크를 길게 눌러 복사해 주세요.' (S07)
  readonly inquiryCopied: string;          // '문의 내용을 복사했어요' (S07)
  readonly recommendationsOpen: string;    // '운영자 추천 상품 보기' — opens the approval-10 fallback dialog (S08)
  readonly recommendationsClose: string;   // '닫기' (S08)
  readonly recommendationPriceChecked: string; // '{date} 확인' — after a price that was checked within 7 days (S08)
  readonly showcaseTitle: string;          // home store showcase heading (S08)
  readonly footerNote: string;             // footer sentence about where the data comes from (S08)
  readonly adSlotLabel: string;            // '광고' — the manual ad slot's accessible name (S08)
}

export interface SiteConfig {
  readonly channels: ChannelsConfig;
  readonly disclosures: DisclosuresConfig;
  readonly calendar: CalendarConfig;
  readonly durations: DurationsConfig;
  readonly lookup: LookupConfig;
  readonly stateGuide: Readonly<Record<GuideKey, GuideRow>>;
  readonly glossary: readonly GlossaryEntry[];
  readonly help: readonly HelpEntry[];
  readonly featuredProducts: readonly FeaturedItem[];
  readonly notices: readonly Notice[];
  readonly ads: AdsConfig;
  readonly style: StyleConfig;
  readonly resultCopy: ResultCopyConfig;
}
export type LoadingConfig = Pick<SiteConfig, "lookup" | "notices">;
