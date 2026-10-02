/**
 * 운영 설정 — tracking.tipoasis.com
 *
 * 공지·연휴·채널 링크·제휴 고지·추천 상품·상태 문구를 이 파일 한 곳에서 바꿉니다. 코드는 고치지 않습니다.
 * 바꾸는 순서와 예시는 DEPLOYMENT.md의 '운영 설정 바꾸기'에 있습니다.
 * 저장하면 빌드가 lib/config/schema.ts로 이 파일을 검사하고, 규칙에 어긋나면 한국어 오류 줄과 함께 배포가 멈춥니다.
 *
 * 꼭 지킬 것
 * - 실제 고객 번호(10자리 이상 숫자, 영문 3~4자+숫자 형식의 HBL 번호)는 어떤 문구에도 넣지 않습니다. 예시는 0만 씁니다.
 * - 'AI·인공지능·로봇·봇' 표현은 쓰지 않습니다.
 * - 이 파일은 형식 선언(import type)만 불러옵니다. 브라우저 코드가 필요한 부분만 가져다 씁니다.
 */
import type {
  AdsConfig, CalendarConfig, ChannelsConfig, DisclosuresConfig, DurationsConfig, FeaturedItem, GlossaryEntry, GuideRow,
  HelpEntry, LookupConfig, Notice, ResultCopyConfig, SiteConfig, StyleConfig
} from "@/lib/config/types";
import type { GuideKey } from "@/lib/tracking/types";

// 스토어 홈 주소. 파트너 대시보드에서 배치별 링크를 따로 만들면 channels.*.urls의 해당 배치만 바꿉니다.
const NAVER_STORE_HOME = "https://mkt.shopping.naver.com/link/6a0bbf9cc55d142f0519328c";
const COUPANG_STORE_HOME = "https://link.coupang.com/a/d7TbzdnS1s";

/** 1) 채널 — 톡톡 상담 주소와 라벨, 네이버·쿠팡 스토어(배치별 링크), 허용 호스트(https만 씁니다) */
export const channels = {
  talk: {
    url: "https://talk.naver.com/ct/w41rsr",
    labels: {
      header: "문의",
      shortcut: "톡톡 상담",
      cta: "톡톡으로 문의하기",
      copyAndTalk: "문의 내용 복사하고 톡톡 열기",
      footer: "톡톡 상담"
    }
  },
  naver: {
    name: "네이버 스토어",
    linkLabel: "네이버 스토어 보기",
    isAffiliate: false,
    // 배치: shortcut 홈 바로가기 행, showcase 홈 쇼케이스, pending 국내 도착 전 구매처 선택지(승인 4), deliveredLead 배송 완료 선두
    urls: { shortcut: NAVER_STORE_HOME, showcase: NAVER_STORE_HOME, pending: NAVER_STORE_HOME, deliveredLead: NAVER_STORE_HOME }
  },
  coupang: {
    name: "쿠팡 스토어",
    linkLabel: "쿠팡 스토어 보기",
    isAffiliate: true, // true면 링크에 rel="sponsored nofollow"와 아래 고지 문구가 자동으로 붙습니다
    urls: { shortcut: COUPANG_STORE_HOME, showcase: COUPANG_STORE_HOME, pending: COUPANG_STORE_HOME, deliveredLead: COUPANG_STORE_HOME }
  },
  // 링크에 쓸 수 있는 호스트. 새 주소를 쓰려면 여기에도 추가합니다.
  allowedHosts: ["talk.naver.com", "mkt.shopping.naver.com", "smartstore.naver.com", "link.coupang.com", "www.coupang.com"]
} satisfies ChannelsConfig;

/** 2) 제휴 고지 — 제휴 링크 묶음의 첫 줄에 자동으로 붙습니다. 승인 9(법무 확인)로 확정한 문언입니다. */
export const disclosures = {
  coupang: "쿠팡 링크는 쿠팡 파트너스 활동의 일환으로, 구매 시 운영자가 수수료를 받습니다."
} satisfies DisclosuresConfig;

/**
 * 3) 달력 — 한국 시간, 공휴일(대체공휴일 포함), 택배 토요일 배송 여부.
 * 매년 6월 말 발표되는 다음 해 월력요항을 보고 추가합니다. 앞으로 60일 안에 공휴일 정보가 없는 해가 있으면 빌드가 경고합니다.
 * badge는 도착 예상 옆에 붙는 문구입니다(연휴가 계산 구간과 겹치면 D-표기와 '오늘 예상'을 숨깁니다).
 */
export const calendar = {
  timeZone: "Asia/Seoul",
  carrierDeliversSaturday: false, // 택배 토요일 배송을 걱정 기준일 계산에 넣으려면 true
  holidays: [
    { id: "2026-new-year", name: "신정", dates: ["2026-01-01"], badge: "신정 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-seollal", name: "설 연휴", dates: ["2026-02-16", "2026-02-17", "2026-02-18"], badge: "설 연휴 영향 · 1~2일 늦어질 수 있어요" },
    { id: "2026-independence-day", name: "삼일절", dates: ["2026-03-01", "2026-03-02"], badge: "삼일절 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-labor-day", name: "노동절", dates: ["2026-05-01"], badge: "노동절 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-childrens-day", name: "어린이날", dates: ["2026-05-05"], badge: "어린이날 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-buddhas-birthday", name: "부처님오신날", dates: ["2026-05-24", "2026-05-25"], badge: "부처님오신날 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-local-election", name: "지방선거일", dates: ["2026-06-03"], badge: "지방선거일 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-memorial-day", name: "현충일", dates: ["2026-06-06"], badge: "현충일 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-constitution-day", name: "제헌절", dates: ["2026-07-17"], badge: "제헌절 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-liberation-day", name: "광복절", dates: ["2026-08-15", "2026-08-17"], badge: "광복절 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-chuseok", name: "추석 연휴", dates: ["2026-09-24", "2026-09-25", "2026-09-26"], badge: "추석 연휴 영향 · 1~2일 늦어질 수 있어요" },
    { id: "2026-foundation-day", name: "개천절", dates: ["2026-10-03", "2026-10-05"], badge: "개천절 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-hangul-day", name: "한글날", dates: ["2026-10-09"], badge: "한글날 영향 · 1일 늦어질 수 있어요" },
    { id: "2026-christmas", name: "성탄절", dates: ["2026-12-25"], badge: "성탄절 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-new-year", name: "신정", dates: ["2027-01-01"], badge: "신정 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-seollal", name: "설 연휴", dates: ["2027-02-06", "2027-02-07", "2027-02-08", "2027-02-09"], badge: "설 연휴 영향 · 1~2일 늦어질 수 있어요" },
    { id: "2027-independence-day", name: "삼일절", dates: ["2027-03-01"], badge: "삼일절 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-labor-day", name: "노동절", dates: ["2027-05-01", "2027-05-03"], badge: "노동절 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-childrens-day", name: "어린이날", dates: ["2027-05-05"], badge: "어린이날 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-buddhas-birthday", name: "부처님오신날", dates: ["2027-05-13"], badge: "부처님오신날 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-memorial-day", name: "현충일", dates: ["2027-06-06"], badge: "현충일 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-constitution-day", name: "제헌절", dates: ["2027-07-17", "2027-07-19"], badge: "제헌절 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-liberation-day", name: "광복절", dates: ["2027-08-15", "2027-08-16"], badge: "광복절 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-chuseok", name: "추석 연휴", dates: ["2027-09-14", "2027-09-15", "2027-09-16"], badge: "추석 연휴 영향 · 1~2일 늦어질 수 있어요" },
    { id: "2027-foundation-day", name: "개천절", dates: ["2027-10-03", "2027-10-04"], badge: "개천절 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-hangul-day", name: "한글날", dates: ["2027-10-09", "2027-10-11"], badge: "한글날 영향 · 1일 늦어질 수 있어요" },
    { id: "2027-christmas", name: "성탄절", dates: ["2027-12-25", "2027-12-27"], badge: "성탄절 영향 · 1일 늦어질 수 있어요" }
  ]
} satisfies CalendarConfig;

/**
 * 4) 소요 기간과 걱정 기준 — 운영자 확인(§17 Q1) 전까지 현재 코드 상수를 씁니다. 4주마다 문의 분류를 보고 조정합니다.
 * 걱정 기준일 = 예상일 뒤 영업일(연휴·주말 제외). 문구 속 일수(7일, 10일, 3~7일)는 아래 값과 같아야 빌드가 통과합니다.
 */
export const durations = {
  stages: {
    visibleAfterDeparture: { min: 3, max: 7 }, // 해외 출고 뒤 HBL이 조회되기까지(일)
    customs: { min: 1, max: 2 },               // 입항 뒤 통관까지(일)
    handoffBusinessDays: { min: 0, max: 1 },   // 통관 완료 뒤 택배사 인계(영업일)
    domestic: { min: 1, max: 2 }               // 국내 배송(일)
  },
  // '보통 이렇게 걸려요' 펼침에 보이는 네 줄
  typical: [
    { station: "departed", text: "해외 출고 후 조회되기까지 보통 3~7일" },
    { station: "customs", text: "입항 후 통관까지 보통 1~2일" },
    { station: "domestic", text: "택배사 인계 0~1영업일, 국내 배송 보통 1~2일" },
    { station: "arrived", text: "배송이 끝나면 택배사 문자로 알려 드려요" }
  ],
  worry: {
    afterEstimateBusinessDays: 1,  // 통관 대기·배송 중: 예상일 + 1영업일까지 그대로면 문의 안내
    afterClearanceBusinessDays: 2, // 통관 완료·인계: 마지막 진행일 + 2영업일
    notFoundDays: 7,               // 결과 없음: 출고 안내 후 7일
    pendingDays: 10,               // 국내 도착 전: 출고 안내 후 10일
    undeliveredHours: 24           // 배송 완료인데 못 받았을 때: 24시간
  },
  staleDays: 14, // 서버 기준(14일)과 같아야 합니다. 다르면 빌드가 멈춥니다.
  // 국내 도착 전 재확인 문장(승인 4 전까지 현행 유지)
  pendingRecheck: "정보 반영까지 시간이 걸릴 수 있어 2~3시간 뒤 다시 확인해 주세요."
} satisfies DurationsConfig;

/**
 * 5) 조회 중 표시 — 시간에 따른 문구와 제한 시간.
 * timeoutMs·notFoundServiceCaveat·stageMs는 서버 개선(승인 5) 배포 뒤 S10 Part B에서 25초·false·[3000, 7000]으로 바꿨습니다.
 */
export const lookup = {
  skeletonDelayMs: 400,      // 이 시간 안에 끝나면 스켈레톤 없이 결과
  stageMs: [3000, 7000],     // 3초: '조금 더 걸려요' + [조회 취소], 7초: '기록이 없는 번호는…' + 경과 시간(R4 서버 개선 뒤 다시 맞춤)
  spinnerStopMs: 5000,       // 스피너는 5초 뒤 멈춥니다
  elapsedStepSeconds: 5,     // 경과 표시 갱신 간격(초)
  timeoutMs: 25000,          // 클라이언트 제한 시간. R4 서버 개선(승인 5) 뒤 25초. 서버는 15초 안에 결과나 API_TIMEOUT을 보냅니다
  rateLimitCooldownSeconds: 10,
  notFoundServiceCaveat: false, // 결과 없음 카드의 '조회 서비스 사정으로…' 보조 줄. R4 뒤에는 서버가 장애를 API_TIMEOUT으로 알리므로 끕니다
  copy: {
    submit: "조회하기",
    submitting: "조회 중…",
    title: "조회하고 있어요",
    body: "관세청 통관 정보와 택배사 배송 정보를 함께 확인해요",
    started: "조회를 시작했어요",
    longWait: "해외 화물은 여러 해의 기록을 찾아서 조금 더 걸려요. 보통 10초 안에 끝나요.",
    veryLongWait: "기록이 없는 번호는 15초 가까이 걸릴 수 있어요. 번호가 맞는지 한 번 봐 주세요.", // R4 뒤 서버가 15초 안에 답함(10월 2일 운영자 결정)
    elapsed: "{seconds}초째",
    cancel: "조회 취소",
    carrierOfficialFirst: "택배사 공식 조회로 먼저 보기",
    formatHint: "숫자 10~14자리 (예: 0000 0000 0000) · 영문 3~4자로 시작하는 HBL (예: ABCD 0000 0000) · 공백·하이픈은 자동으로 빼요",
    numberFinderSummary: "번호는 어디서 찾나요?",
    numberFinderItems: ["네이버 주문상세 → 배송조회", "쿠팡 주문목록 → 배송조회", "톡톡 출고 안내문"],
    carrierAuto: "택배사 자동 확인",
    typicalSummary: "보통 이렇게 걸려요",
    // 자바스크립트가 꺼진 브라우저에서 번호 링크를 열었을 때 번호 바 위에 보이는 안내
    noscriptNotice: "자바스크립트가 꺼져 있어 조회 결과를 보여 드릴 수 없어요. 브라우저 설정에서 켠 뒤 다시 열어 주세요."
  }
} satisfies LookupConfig;

/**
 * 6) 상태 안내 표 — 상태마다 톤, 칩, 제목(h2), 이유, 지금 할 일, 걱정 기준 문장, 주 행동, 문의·스토어·추천·광고 자리, 도착 예상 방식.
 * 문구에 쓸 수 있는 토큰: {etaDate} {worryDate} {lastEventDate} {carrier} {staleDays}
 * 불변식(빌드가 검사): 문제 상태는 스토어·추천·광고 0, 배송 중은 스토어 0, 배송 완료는 스토어 선두, 국내 도착 전은 문의 + 구매처.
 * overdueTitle은 걱정 기준일이 지났을 때의 제목이며 통관·배송 진행 상태 여섯 곳에만 씁니다.
 */
export const stateGuide = {
  idle: {
    tone: "neutral", chip: null, docTitle: "통관·배송 조회",
    title: "통관부터 국내 배송까지 한 번에 확인", overdueTitle: null,
    reason: "운송장 번호나 HBL 번호를 넣으면 지금 위치, 도착 예정일, 지금 할 일을 알려 드려요.",
    ctaHeading: null, nextAction: "번호를 넣고 조회하기를 눌러 주세요.", worry: null,
    primaryAction: "submit", inquiryLevel: "shortcutRow", revenueTier: "quiet", stores: "shortcutRow", recommendations: "none", etaMode: "none"
  },
  loading: {
    tone: "neutral", chip: null, docTitle: "조회 중",
    title: "조회하고 있어요", overdueTitle: null,
    reason: "관세청 통관 정보와 택배사 배송 정보를 함께 확인해요",
    ctaHeading: null, nextAction: "잠시만 기다려 주세요.", worry: null,
    primaryAction: "none", inquiryLevel: "header", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  invalidNumber: {
    tone: "attention", chip: "번호 확인", docTitle: "번호 형식 확인",
    title: "번호 형식이 달라요. 숫자 10~14자리 또는 영문 3~4자+숫자예요.", overdueTitle: null,
    reason: null,
    ctaHeading: "조회가 잘되지 않나요?", nextAction: "번호를 모르시면 주문 안내 문자나 톡톡으로 확인해 드려요", worry: null,
    primaryAction: "fixNumber", inquiryLevel: "blockFirstLink", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  notFound: {
    tone: "attention", chip: "조회 결과 없음", docTitle: "조회 결과 없음",
    title: "아직 조회되는 정보가 없어요", overdueTitle: null,
    reason: "이 번호가 주문내역과 같나요? 같다면 아직 한국 도착 전일 수 있어요. 보통 해외 출고 후 3~7일 뒤부터 조회돼요.",
    ctaHeading: "조회가 잘되지 않나요?", nextAction: "번호가 주문내역과 같은지 먼저 확인해 주세요.",
    worry: "출고 안내를 받은 지 7일이 지나도 조회되지 않으면 번호를 보내 주세요",
    primaryAction: "fixNumber", inquiryLevel: "blockFirstLink", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  temporaryDelay: {
    tone: "attention", chip: "조회 지연", docTitle: "조회 지연",
    title: "조회가 잠시 지연되고 있어요", overdueTitle: null,
    reason: "번호 문제는 아니에요.",
    ctaHeading: "조회가 잘되지 않나요?", nextAction: "잠시 뒤 다시 조회해 주세요. 두 번 이상 안 되면 알려 주세요.", worry: null,
    primaryAction: "retry", inquiryLevel: "blockFirstLink", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  offline: {
    tone: "attention", chip: "연결 끊김", docTitle: "인터넷 연결 끊김",
    title: "인터넷 연결이 끊겼어요", overdueTitle: null,
    reason: "연결이 돌아오면 한 번 자동으로 다시 조회해요.",
    ctaHeading: "조회가 잘되지 않나요?", nextAction: "와이파이나 데이터 연결을 확인해 주세요.", worry: null,
    primaryAction: "retry", inquiryLevel: "blockFirstLink", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  noResponse: {
    tone: "attention", chip: "응답 없음", docTitle: "응답 없음",
    title: "응답이 너무 오래 걸려 조회를 멈췄어요", overdueTitle: null,
    reason: "번호가 주문내역과 같은지 확인해 주세요. 맞다면 잠시 뒤 다시 조회해 주세요.",
    ctaHeading: "조회가 잘되지 않나요?", nextAction: "계속 안 되면 톡톡으로 알려 주세요.", worry: null,
    primaryAction: "retry", inquiryLevel: "blockFirstLink", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  serverError: {
    tone: "problem", chip: "조회 오류", docTitle: "조회 오류",
    title: "일시적인 오류로 조회하지 못했어요", overdueTitle: null,
    reason: "번호 문제는 아니에요. 번호를 보내 주시면 확인해 드려요.",
    ctaHeading: "조회가 잘되지 않나요?", nextAction: "문의 내용을 복사해 톡톡으로 보내 주세요.", worry: null,
    primaryAction: "copyAndTalk", inquiryLevel: "primary", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  pending: {
    tone: "waiting", chip: "국내 도착 전", docTitle: "통관 정보 등록 전",
    title: "통관 정보 등록 전", overdueTitle: null,
    reason: "아직 국내 도착·통관 기록이 없어요. 해외에서 출발한 직후이거나 번호가 다를 수 있어요.",
    ctaHeading: "아직 국내 배송 정보가 없어요", nextAction: "이 번호가 주문내역의 운송장 번호와 같나요?",
    worry: "출고 안내 후 10일이 지나도 이 화면이면 알려 주세요",
    primaryAction: "fixNumber", inquiryLevel: "ctaButton", revenueTier: "quiet", stores: "purchaseChoices", recommendations: "inline", etaMode: "pendingInfo"
  },
  customsArrived: {
    tone: "progress", chip: "통관 준비", docTitle: "통관 준비 중",
    title: "한국에 도착해 통관을 준비하고 있어요",
    overdueTitle: "{worryDate}이 지났는데 아직 통관이 시작되지 않았어요",
    reason: "입항 신고가 끝나면 세관 접수와 심사가 이어져요.",
    ctaHeading: "지금 할 일", nextAction: "지금은 하실 일이 없어요. 통관이 시작되면 순서대로 진행돼요.",
    worry: "{worryDate}까지 그대로면 알려 주세요",
    primaryAction: "none", inquiryLevel: "worryLink", revenueTier: "quiet", stores: "none", recommendations: "optional", etaMode: "estimate"
  },
  customsWaiting: {
    tone: "progress", chip: "통관 대기", docTitle: "통관 대기 중",
    title: "통관 순서를 기다리고 있어요",
    overdueTitle: "{worryDate}이 지났는데 아직 통관이 끝나지 않았어요",
    reason: "세관 접수가 끝났고 순서대로 심사가 진행돼요.",
    ctaHeading: "지금 할 일", nextAction: "지금은 하실 일이 없어요. 통관이 끝나면 택배사로 넘어가요.",
    worry: "{worryDate}까지 그대로면 알려 주세요",
    primaryAction: "none", inquiryLevel: "worryLink", revenueTier: "quiet", stores: "none", recommendations: "optional", etaMode: "estimate"
  },
  customsCleared: {
    tone: "progress", chip: "통관 완료", docTitle: "통관 완료",
    title: "통관이 끝났어요",
    overdueTitle: "{worryDate}이 지났는데 아직 택배사로 넘어가지 않았어요",
    reason: "세관 처리가 끝나 국내 택배사로 넘어갈 차례예요.",
    ctaHeading: "지금 할 일", nextAction: "지금은 하실 일이 없어요. 택배사로 넘어가면 운송장 문자가 와요.",
    worry: "{worryDate}까지 소식이 없으면 알려 주세요",
    primaryAction: "none", inquiryLevel: "worryLink", revenueTier: "quiet", stores: "none", recommendations: "optional", etaMode: "estimate"
  },
  handedToCarrier: {
    tone: "progress", chip: "국내 배송", docTitle: "택배사 인계",
    title: "택배사에 넘어갔어요",
    overdueTitle: "{worryDate}이 지났는데 아직 배송이 시작되지 않았어요",
    reason: "{carrier}에서 배송을 준비하고 있어요.",
    ctaHeading: "지금 할 일", nextAction: "배송이 시작되면 택배사 문자가 와요. 지금 위치는 택배사 조회에서 볼 수 있어요.",
    worry: "{worryDate}까지 소식이 없으면 알려 주세요",
    primaryAction: "carrierOfficial", inquiryLevel: "worryLink", revenueTier: "quiet", stores: "none", recommendations: "optional", etaMode: "estimate"
  },
  pickedUp: {
    tone: "progress", chip: "국내 배송", docTitle: "기사님 픽업 완료",
    title: "{carrier} 기사님 픽업 완료!",
    overdueTitle: "{worryDate}이 지났는데 아직 배송이 시작되지 않았어요",
    reason: "{carrier} 기사님이 상품을 인수해 배송 출발을 준비하고 있어요.",
    ctaHeading: "지금 할 일", nextAction: "배송이 시작되면 택배사 조회에서 위치를 볼 수 있어요.",
    worry: "{worryDate}까지 소식이 없으면 알려 주세요",
    primaryAction: "carrierOfficial", inquiryLevel: "worryLink", revenueTier: "quiet", stores: "none", recommendations: "optional", etaMode: "estimate"
  },
  inTransit: {
    tone: "progress", chip: "국내 배송", docTitle: "국내 배송 중",
    title: "국내 배송 중",
    overdueTitle: "{worryDate}이 지났는데 아직 배송이 끝나지 않았어요",
    reason: "택배사가 주소지로 배송하고 있어요.",
    ctaHeading: "배송이 진행 중이에요", nextAction: "정확한 도착 시간은 택배사 문자나 실시간 조회에서 볼 수 있어요.",
    worry: "{worryDate}까지 안 오면 알려 주세요",
    primaryAction: "carrierOfficial", inquiryLevel: "textLink", revenueTier: "quiet", stores: "none", recommendations: "inline", etaMode: "estimate"
  },
  delivered: {
    tone: "done", chip: "도착", docTitle: "배송 완료",
    title: "배송 완료", overdueTitle: null,
    reason: null,
    ctaHeading: "배송이 완료됐어요", nextAction: "받지 못하셨다면 문 앞·경비실·택배함을 먼저 확인해 주세요.", worry: null,
    primaryAction: "storeLead", inquiryLevel: "afterStores", revenueTier: "lead", stores: "ctaLead", recommendations: "inline", etaMode: "deliveredOn"
  },
  stale: {
    tone: "attention", chip: "확인 필요", docTitle: "배송 이력 확인 필요",
    title: "{staleDays}일 넘게 새 소식이 없어요", overdueTitle: null,
    reason: "마지막 처리는 {lastEventDate}이에요. 보통은 1~2일 안에 다음 단계로 넘어가요.",
    ctaHeading: "지금 할 일", nextAction: "확인이 필요해요. 문의 내용을 복사해 톡톡으로 보내 주세요.", worry: null,
    primaryAction: "copyAndTalk", inquiryLevel: "primary", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "withheld"
  },
  lookupUnavailable: {
    tone: "attention", chip: "택배사 조회 지연", docTitle: "택배사 조회 지연",
    title: "택배사 조회가 잠시 늦어지고 있어요", overdueTitle: null,
    reason: "택배사 응답이 늦어 최신 배송 정보를 불러오지 못했어요. 번호 문제는 아니에요.",
    ctaHeading: "지금 할 일", nextAction: "{carrier} 공식 조회에서 바로 확인할 수 있어요.", worry: null,
    primaryAction: "carrierOfficial", inquiryLevel: "textLink", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  },
  ambiguous: {
    tone: "attention", chip: "택배사 선택", docTitle: "택배사 선택 필요",
    title: "받으실 택배사를 골라 주세요", overdueTitle: null,
    reason: "같은 번호가 여러 택배사에 있어요.",
    ctaHeading: "택배사 선택", nextAction: "주문 안내 문자에 택배사 이름이 있어요. 고르시면 바로 다시 조회해요.", worry: null,
    primaryAction: "chooseCarrier", inquiryLevel: "textLink", revenueTier: "none", stores: "none", recommendations: "none", etaMode: "none"
  }
} satisfies Readonly<Record<GuideKey, GuideRow>>;

/** 7) 용어 풀이 — 세관·택배사 원문을 고객 말로 바꿉니다. 원문은 작게 함께 보입니다. */
export const glossary = [
  { source: "반입신고", label: "보세창고 도착" },
  { source: "통관목록접수", label: "통관 접수" },
  { source: "통관목록심사", label: "통관 심사" },
  { source: "통관목록심사완료", label: "통관 심사 완료" },
  { source: "수입신고", label: "수입 신고" },
  { source: "수입신고수리", label: "통관 완료" },
  { source: "반출신고", label: "보세창고 출고" },
  { source: "집화처리", label: "기사님 픽업" },
  { source: "간선상차", label: "터미널 출발" },
  { source: "간선하차", label: "지역 터미널 도착" },
  { source: "배송출발", label: "배송 출발" },
  { source: "배달출발", label: "배송 출발" },
  { source: "배송완료", label: "배송 완료" },
  { source: "배달완료", label: "배송 완료" }
] satisfies readonly GlossaryEntry[];

/** 8) 도움말 펼침 — showIn 상태에서 보이고, openIn 상태에서는 처음부터 펼쳐져 있습니다. */
export const help = [
  {
    id: "pre-arrival", summary: "입항 전 화물이 조회되지 않는 이유",
    body: ["해외에서 출고된 화물은 한국에 도착해 입항 신고가 끝나야 조회돼요.", "보통 해외 출고 후 3~7일 뒤부터 조회돼요."],
    showIn: ["notFound", "pending"], openIn: []
  },
  {
    id: "order-check", summary: "주문내역에서 확인",
    body: ["네이버: 주문상세 → 배송조회에서 같은 번호를 볼 수 있어요.", "쿠팡: 주문목록 → 배송조회에서 볼 수 있어요.", "톡톡 출고 안내문에도 번호와 택배사가 있어요."],
    showIn: ["pending", "notFound"], openIn: []
  },
  {
    id: "customs-delay", summary: "통관이 늦어지는 흔한 이유",
    body: [
      "개인통관고유부호나 수취인 이름이 주문 정보와 다르면 통관이 멈출 수 있어요.",
      "연휴와 주말에는 세관이 쉬어서 다음 영업일부터 이어져요.",
      "세관이 서류를 더 요청하면 하루 이틀 더 걸릴 수 있어요."
    ],
    showIn: ["customsArrived", "customsWaiting", "stale"], openIn: ["stale"]
  },
  {
    id: "handoff", summary: "택배사로 넘어가는 데 걸리는 시간",
    body: ["통관이 끝나면 보통 0~1영업일 안에 택배사로 넘어가요.", "택배사로 넘어가면 운송장 문자가 와요."],
    showIn: ["customsCleared", "handedToCarrier", "pickedUp"], openIn: []
  },
  {
    id: "absence", summary: "부재·주소 변경",
    body: ["주소를 바꾸려면 택배사 고객센터나 기사님께 바로 알려 주세요.", "집에 없으면 기사님이 문 앞이나 경비실에 두고 문자를 보내요."],
    showIn: ["inTransit"], openIn: []
  },
  {
    id: "undelivered", summary: "받지 못하셨나요?",
    body: ["문 앞·경비실·택배함을 먼저 확인해 주세요.", "기사님 연락처가 있으면 기사님께 먼저 물어봐 주세요.", "24시간이 지나도 찾지 못하시면 톡톡으로 알려 주세요."],
    showIn: ["delivered"], openIn: []
  },
  {
    id: "return-exchange", summary: "반품·교환",
    body: ["반품·교환은 주문하신 스토어의 주문내역에서 신청할 수 있어요."],
    showIn: ["delivered"], openIn: []
  },
  {
    id: "stale-causes", summary: "새 소식이 멈추는 흔한 이유",
    body: ["세관이 서류 보완을 요청했을 수 있어요.", "택배사 전산 반영이 늦어질 수 있어요."],
    showIn: ["stale"], openIn: []
  }
] satisfies readonly HelpEntry[];

/**
 * 9) 추천 상품 — 결과 화면 인라인 목록(다이얼로그 없음). 유효기간(+09:00) 안의 상품만 보이고, 0개면 목록이 사라집니다.
 * href는 상품 상세 https 주소로 바꿔 주세요(지금은 스토어 홈). 가격은 확인 시각(priceCheckedAt)과 함께일 때만 적습니다.
 */
export const featuredProducts = [
  {
    id: "carpodgo-carplay", name: "Carpodgo mini 6.99인치 카플레이", channel: "naver", href: NAVER_STORE_HOME, isAffiliate: false,
    validFrom: "2026-09-01T00:00:00+09:00", validUntil: "2027-03-31T23:59:59+09:00", priceLabel: null, priceCheckedAt: null,
    contexts: ["pending", "inTransit", "delivered"]
  },
  {
    id: "svbony-eyepiece", name: "SVBONY 천체 망원경 접안 렌즈", channel: "coupang", href: COUPANG_STORE_HOME, isAffiliate: true,
    validFrom: "2026-09-01T00:00:00+09:00", validUntil: "2027-03-31T23:59:59+09:00", priceLabel: null, priceCheckedAt: null,
    contexts: ["pending", "inTransit", "delivered"]
  },
  {
    id: "model-y-mat", name: "테슬라 모델 Y 전천후 전면 매트", channel: "naver", href: NAVER_STORE_HOME, isAffiliate: false,
    validFrom: "2026-09-01T00:00:00+09:00", validUntil: "2027-03-31T23:59:59+09:00", priceLabel: null, priceCheckedAt: null,
    contexts: ["pending", "inTransit", "delivered"]
  },
  {
    id: "blue-archive-display", name: "블루 아카이브 아크릴 전시 케이스", channel: "coupang", href: COUPANG_STORE_HOME, isAffiliate: true,
    validFrom: "2026-09-01T00:00:00+09:00", validUntil: "2027-03-31T23:59:59+09:00", priceLabel: null, priceCheckedAt: null,
    contexts: ["pending", "inTransit", "delivered"]
  }
] satisfies readonly FeaturedItem[];

/**
 * 10) 공지 — 시작 시각에 켜지고 종료 시각에 꺼집니다(한국 시간 +09:00). 제목 20자, 본문 80자 이하, 한 화면에 1개.
 * 우선순위: outage(장애) > delay(지연) > holiday(연휴) > info(안내). home: 홈 한 줄, guideKeys: 결과 카드 안 '안내' 줄, cs: CS 답변 끝.
 * 조회 중·일시 지연 화면에는 outage만 보입니다. 예시는 DEPLOYMENT.md에 있습니다.
 */
export const notices = [
  {
    id: "2026-chuseok", kind: "holiday", title: "추석 연휴 배송 안내",
    body: "추석 연휴(9/24~26)와 주말에는 통관·택배가 쉬어요. 9월 28일(월)부터 순서대로 진행돼요.",
    startsAt: "2026-09-21T00:00:00+09:00", endsAt: "2026-09-29T00:00:00+09:00", home: true,
    guideKeys: ["pending", "customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp", "inTransit"], cs: true
  },
  {
    id: "2026-october-holidays", kind: "holiday", title: "10월 공휴일 배송 안내",
    body: "개천절(10/3)과 대체공휴일(10/5), 한글날(10/9)에는 통관·택배가 쉬어요. 다음 영업일부터 순서대로 진행돼요.",
    startsAt: "2026-09-30T00:00:00+09:00", endsAt: "2026-10-10T00:00:00+09:00", home: true,
    guideKeys: ["pending", "customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp", "inTransit"], cs: true
  }
] satisfies readonly Notice[];

/** 11) 광고 — 수동 광고 단위 ID는 승인 15 뒤에 넣습니다(null이면 슬롯을 그리지 않습니다). 높이는 자리 예약용입니다. */
export const ads = {
  manualSlotId: null,
  minHeightMobilePx: 280,
  minHeightDesktopPx: 250,
  anchorReservePx: 64
} satisfies AdsConfig;

/** 12) 화면 스타일 — 기기가 어두운 모드면 '어두운 화면'으로 시작할지 */
export const style = { followSystemDark: true } satisfies StyleConfig;

/** 13) 결과 화면 공통 문구 — 도착 예상 라벨, 버튼 이름, 처리 내역 요약 등. {date} {n} {time} {seconds} {carrier} 자리는 정해진 곳에만 씁니다. */
export const resultCopy = {
  etaLabel: "도착 예상",
  etaTodayLabel: "오늘 예상",
  etaOverdueLabel: "예상했던 날짜",
  etaDeliveredLabel: "배송 완료일",
  etaPendingText: "정보 등록 후 안내",
  etaWithheldText: "지금은 도착 예상일을 안내하기 어려워요",
  etaUnknownText: "아직 예상일을 계산할 기록이 없어요",
  customsEstimateCaption: "통관 완료 예상 {date}",
  customsDoneCaption: "통관 완료 {date}",
  overdueChip: "확인 필요",
  overdueSentence: "확인이 필요해요. 문의 내용을 복사해 톡톡으로 보내 주세요.",
  carrierUnknown: "택배사",
  carrierUnassigned: "택배사 배정 전",
  issueStopped: "멈춤",
  issueCut: "끊김",
  issueBranch: "갈림",
  stationDeparted: "해외 출발",
  stationCustoms: "입항·통관",
  stationDomestic: "국내 배송",
  stationArrived: "도착",
  historySummary: "처리 내역 {n}건 보기",
  historyLast: "마지막 {time}",
  historyEmpty: "아직 처리 내역이 없어요",
  actionFixNumber: "번호 수정",
  actionRetry: "다시 조회",
  actionCarrierOfficial: "{carrier} 공식 배송조회",
  actionCarrierLive: "{carrier}에서 실시간 위치 보기",
  actionCallDriver: "기사님께 전화",
  actionReturnLink: "다시 볼 링크 복사",
  actionUndelivered: "받지 못하셨나요?",
  pendingStoresIntro: "주문하신 곳에서도 배송 안내를 볼 수 있어요",
  notFoundCaveat: "조회 서비스 사정으로 결과가 없을 수도 있어요",
  carrierCutLine: "택배사 조회가 잠시 늦어요",
  rateLimitedReason: "조회가 몰려 {seconds}초 뒤 다시 조회할 수 있어요",
  customsCheckNote: "개인통관고유부호와 수취인 이름이 주문 정보와 같은지도 확인해 주세요",
  chooseCarrierSentence: "택배사를 고르시면 같은 번호로 바로 다시 조회해요.",
  // [다시 볼 링크 복사]와 문의 내용 복사를 누른 뒤 버튼에 잠깐 보이는 문구, 복사가 막힌 앱에서 보이는 안내
  returnLinkCopied: "링크를 복사했어요",
  returnLinkShared: "링크를 공유했어요",
  returnLinkFallback: "아래 링크를 길게 눌러 복사해 주세요.",
  inquiryCopied: "문의 내용을 복사했어요",
  // 결과 아래 추천 묶음(승인 10 전에는 '운영자 추천' 창을 여는 버튼과 닫기 버튼), 가격 옆 확인일({date} 자리 필수)
  recommendationsOpen: "운영자 추천 상품 보기",
  recommendationsClose: "닫기",
  recommendationPriceChecked: "{date} 확인",
  // 홈 첫 화면 아래 스토어 묶음 제목, 푸터 안내 문장, 수동 광고 자리의 이름(화면 읽기용)
  showcaseTitle: "판매 중인 상품 둘러보기",
  footerNote: "입력한 번호로 관세청 통관 정보와 택배사 배송 정보를 함께 조회해요. 정보가 반영되는 시점에 따라 실제와 조금 다를 수 있어요.",
  adSlotLabel: "광고"
} satisfies ResultCopyConfig;

/** 전체 설정(서버·내부 도구·결과 지연 청크용). 브라우저 코드는 위의 필요한 부분만 가져다 씁니다. */
export const siteConfig = {
  channels, disclosures, calendar, durations, lookup, stateGuide, glossary, help, featuredProducts, notices, ads, style, resultCopy
} satisfies SiteConfig;
