import { z } from "zod";
import { DIGIT_RUN_PATTERN, HBL_LIKE_PATTERN } from "@/lib/privacy/number-patterns";
import { ERROR_GUIDE_KEYS, GUIDE_KEYS, OVERDUE_CAPABLE_KEYS, PROBLEM_GUIDE_KEYS } from "@/lib/tracking/types";
import type { GuideKey } from "@/lib/tracking/types";
import { COPY_TOKENS, tokensIn } from "@/lib/tracking/template";
import type { ResultCopyConfig, SiteConfig } from "@/lib/config/types";

/** Slots each resultCopy field must contain — no more, no fewer. */
export const RESULT_COPY_SLOTS = {
  etaLabel: [], etaTodayLabel: [], etaOverdueLabel: [], etaDeliveredLabel: [],
  etaPendingText: [], etaWithheldText: [], etaUnknownText: [],
  customsEstimateCaption: ["date"], customsDoneCaption: ["date"],
  overdueChip: [], overdueSentence: [],
  carrierUnknown: [], carrierUnassigned: [],
  issueStopped: [], issueCut: [], issueBranch: [],
  stationDeparted: [], stationCustoms: [], stationDomestic: [], stationArrived: [],
  historySummary: ["n"], historyLast: ["time"], historyEmpty: [],
  actionFixNumber: [], actionRetry: [], actionCarrierOfficial: ["carrier"], actionCarrierLive: ["carrier"],
  actionCallDriver: [], actionReturnLink: [], actionUndelivered: [],
  pendingStoresIntro: [], notFoundCaveat: [], carrierCutLine: [], rateLimitedReason: ["seconds"],
  customsCheckNote: [], chooseCarrierSentence: []
} satisfies Readonly<Record<keyof ResultCopyConfig, readonly string[]>>;

export const SERVER_STALE_DAYS = 14; // lib/services/normalizer.ts STALE_AFTER_DAYS
export const NOTICE_TITLE_MAX = 20;
export const NOTICE_BODY_MAX = 80;

type Path = readonly (string | number)[];
type Report = (path: Path, message: string) => void;

const STATE_TEXT_FIELDS = ["chip", "docTitle", "title", "overdueTitle", "reason", "ctaHeading", "nextAction", "worry"] as const;
const NORMAL_WAITING_KEYS: readonly GuideKey[] = ["customsArrived", "customsWaiting", "customsCleared"];
const ERROR_KEYS: ReadonlySet<GuideKey> = new Set<GuideKey>(ERROR_GUIDE_KEYS);
const OVERDUE_KEYS: ReadonlySet<GuideKey> = new Set<GuideKey>(OVERDUE_CAPABLE_KEYS);
const STATE_TOKENS: ReadonlySet<string> = new Set<string>(COPY_TOKENS);
/** Keys whose values are identifiers, dates, URLs or enum values — not customer copy. */
const SKIP_COPY_KEYS: ReadonlySet<string> = new Set([
  "url", "urls", "href", "allowedHosts", "id", "dates", "validFrom", "validUntil", "priceCheckedAt", "startsAt", "endsAt",
  "timeZone", "manualSlotId", "source", "tone", "primaryAction", "inquiryLevel", "revenueTier", "stores", "recommendations",
  "etaMode", "kind", "channel", "station", "guideKeys", "showIn", "openIn", "contexts"
]);
const AI_PATTERN = /(^|[^A-Za-z])AI([^A-Za-z]|$)|인공지능|로봇|봇/;
const ZERO_RUN = /^0+$/;
const ELAPSED_PATH = "lookup.copy.elapsed";

function allMatches(pattern: RegExp, text: string): readonly string[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return text.match(new RegExp(pattern.source, flags)) ?? [];
}

function checkSlots(text: string, required: readonly string[], path: Path, report: Report): void {
  const found = new Set(tokensIn(text));
  for (const slot of required) if (!found.has(slot)) report(path, `{${slot}} 자리가 필요합니다`);
  for (const token of found) if (!required.includes(token)) report(path, `허용되지 않은 토큰 {${token}}입니다`);
}

function visitStrings(value: unknown, path: Path, visit: (text: string, path: Path) => void): void {
  if (typeof value === "string") {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    (value as readonly unknown[]).forEach((item, index) => visitStrings(item, [...path, index], visit));
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value as Readonly<Record<string, unknown>>)) {
      if (!SKIP_COPY_KEYS.has(key)) visitStrings(child, [...path, key], visit);
    }
  }
}

function checkTokenPolicy(text: string, path: Path, report: Report): void {
  const [section, field] = path;
  if (section === "stateGuide") return; // checked with the five CopyTokens in checkStateCopy
  if (section === "resultCopy" && typeof field === "string" && field in RESULT_COPY_SLOTS) {
    checkSlots(text, RESULT_COPY_SLOTS[field as keyof ResultCopyConfig], path, report);
    return;
  }
  if (path.join(".") === ELAPSED_PATH) {
    checkSlots(text, ["seconds"], path, report);
    return;
  }
  if (tokensIn(text).length > 0) report(path, "이 문구에는 토큰을 쓸 수 없습니다");
}

/** A token the renderer can fill: '{' + ASCII letters + '}'. */
const WELL_FORMED_TOKEN = /\{[A-Za-z]+\}/g;

function checkCopyText(config: SiteConfig, report: Report): void {
  visitStrings(config, [], (text, path) => {
    const realRuns = allMatches(DIGIT_RUN_PATTERN, text).filter((run) => !ZERO_RUN.test(run.replace(/[ -]/g, "")));
    if (realRuns.length > 0) report(path, "10자리 이상 숫자를 쓸 수 없습니다");
    if (allMatches(HBL_LIKE_PATTERN, text).length > 0) report(path, "HBL 형식 번호를 쓸 수 없습니다");
    if (AI_PATTERN.test(text)) report(path, "AI·인공지능·로봇·봇 표현을 쓸 수 없습니다");
    // '{worry_date}', '{ worryDate }', '{날짜}' or a stray brace would reach customers as raw text.
    if (/[{}]/.test(text.replace(WELL_FORMED_TOKEN, ""))) report(path, "중괄호 {…} 모양이 잘못됐습니다");
    checkTokenPolicy(text, path, report);
  });
}

function checkPlacement(config: SiteConfig, report: Report): void {
  const noRevenueKeys: readonly GuideKey[] = [...PROBLEM_GUIDE_KEYS, "loading"];
  for (const key of noRevenueKeys) {
    const row = config.stateGuide[key];
    const who = key === "loading" ? "조회 중" : "문제 상태";
    if (row.stores !== "none") report(["stateGuide", key, "stores"], `${who}에는 스토어를 둘 수 없습니다`);
    if (row.recommendations !== "none") report(["stateGuide", key, "recommendations"], `${who}에는 추천 상품을 둘 수 없습니다`);
    if (row.revenueTier !== "none") report(["stateGuide", key, "revenueTier"], `${who}에는 광고를 둘 수 없습니다`);
  }
  const guide = config.stateGuide;
  if (guide.inTransit.stores !== "none") report(["stateGuide", "inTransit", "stores"], "배송 중에는 스토어를 둘 수 없습니다");
  if (guide.delivered.stores !== "ctaLead") report(["stateGuide", "delivered", "stores"], "배송 완료는 스토어가 먼저 와야 합니다");
  if (guide.delivered.primaryAction !== "storeLead") report(["stateGuide", "delivered", "primaryAction"], "배송 완료는 스토어가 먼저 와야 합니다");
  if (guide.pending.stores !== "purchaseChoices") report(["stateGuide", "pending", "stores"], "국내 도착 전에는 구매처 선택지가 있어야 합니다");
  if (guide.pending.inquiryLevel !== "ctaButton") report(["stateGuide", "pending", "inquiryLevel"], "국내 도착 전에는 문의 버튼이 있어야 합니다");
  for (const key of NORMAL_WAITING_KEYS) {
    if (guide[key].primaryAction !== "none") report(["stateGuide", key, "primaryAction"], "정상 대기 상태에는 채움 버튼을 둘 수 없습니다");
  }
  if (guide.stale.etaMode !== "withheld") report(["stateGuide", "stale", "etaMode"], "정체 상태는 예상일 대신 확인 안내를 보여야 합니다");
  if (guide.pending.etaMode !== "pendingInfo") report(["stateGuide", "pending", "etaMode"], "국내 도착 전에는 '정보 등록 후 안내'를 보여야 합니다");
  if (guide.delivered.etaMode !== "deliveredOn") report(["stateGuide", "delivered", "etaMode"], "배송 완료에는 배송 완료일을 보여야 합니다");
  for (const key of GUIDE_KEYS) {
    if (guide[key].tone === "problem" && !ERROR_KEYS.has(key)) report(["stateGuide", key, "tone"], "빨간 톤은 오류 상태에만 쓸 수 있습니다");
  }
  const hasAffiliate = config.channels.naver.isAffiliate || config.channels.coupang.isAffiliate
    || config.featuredProducts.some((item) => item.isAffiliate);
  if (hasAffiliate && config.disclosures.coupang.trim().length === 0) {
    report(["disclosures", "coupang"], "제휴 링크에는 고지 문구가 필요합니다");
  }
}

function checkStateCopy(config: SiteConfig, report: Report): void {
  for (const key of GUIDE_KEYS) {
    const row = config.stateGuide[key];
    for (const field of STATE_TEXT_FIELDS) {
      const text = row[field];
      if (text === null) continue;
      for (const token of new Set(tokensIn(text))) {
        if (!STATE_TOKENS.has(token)) report(["stateGuide", key, field], `허용되지 않은 토큰 {${token}}입니다`);
      }
    }
    if (/\d|\{/.test(row.docTitle)) report(["stateGuide", key, "docTitle"], "문서 제목에는 숫자나 토큰을 쓸 수 없습니다");
    if (OVERDUE_KEYS.has(key)) {
      if (row.overdueTitle === null) report(["stateGuide", key, "overdueTitle"], "기준일이 지난 상태의 제목이 필요합니다");
      if (row.worry === null || !row.worry.includes("{worryDate}")) report(["stateGuide", key, "worry"], "{worryDate} 자리가 필요합니다");
    } else if (row.overdueTitle !== null) {
      report(["stateGuide", key, "overdueTitle"], "이 상태에는 기준일 경과 제목을 쓸 수 없습니다");
    }
  }
}

function checkDurations(config: SiteConfig, report: Report): void {
  const { durations, stateGuide } = config;
  if (durations.staleDays !== SERVER_STALE_DAYS) report(["durations", "staleDays"], `서버 기준(${SERVER_STALE_DAYS}일)과 같아야 합니다`);
  const { notFoundDays, pendingDays } = durations.worry;
  if (!(stateGuide.notFound.worry ?? "").includes(`${notFoundDays}일`)) {
    report(["stateGuide", "notFound", "worry"], `걱정 기준(${notFoundDays}일)과 문구가 다릅니다`);
  }
  if (!(stateGuide.pending.worry ?? "").includes(`${pendingDays}일`)) {
    report(["stateGuide", "pending", "worry"], `걱정 기준(${pendingDays}일)과 문구가 다릅니다`);
  }
  const { min, max } = durations.stages.visibleAfterDeparture;
  if (!(stateGuide.notFound.reason ?? "").includes(`${min}~${max}일`)) {
    report(["stateGuide", "notFound", "reason"], `조회 가능 시점(${min}~${max}일)과 문구가 다릅니다`);
  }
}

function checkLookup(config: SiteConfig, report: Report): void {
  const { skeletonDelayMs, stageMs, spinnerStopMs, timeoutMs } = config.lookup;
  const [longMs, veryLongMs] = stageMs;
  if (!(skeletonDelayMs < longMs && longMs < veryLongMs && veryLongMs < timeoutMs)) {
    report(["lookup", "stageMs"], "단계 시각은 스켈레톤 < 긴 대기 < 아주 긴 대기 < 제한 시간 순서여야 합니다");
  }
  if (spinnerStopMs >= timeoutMs) report(["lookup", "spinnerStopMs"], "스피너 정지 시각은 제한 시간보다 빨라야 합니다");
}

function checkNotices(config: SiteConfig, report: Report): void {
  config.notices.forEach((notice, index) => {
    if ([...notice.title].length > NOTICE_TITLE_MAX) report(["notices", index, "title"], `제목은 ${NOTICE_TITLE_MAX}자 이하여야 합니다`);
    if ([...notice.body].length > NOTICE_BODY_MAX) report(["notices", index, "body"], `본문은 ${NOTICE_BODY_MAX}자 이하여야 합니다`);
    if (!(Date.parse(notice.endsAt) > Date.parse(notice.startsAt))) report(["notices", index, "endsAt"], "종료 시각이 시작보다 빠릅니다");
  });
}

function checkHosts(config: SiteConfig, report: Report): void {
  const allowed = new Set(config.channels.allowedHosts);
  const checkUrl = (url: string, path: Path): void => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      report(path, "주소 형식이 아닙니다");
      return;
    }
    if (parsed.protocol !== "https:") {
      report(path, "https 주소만 쓸 수 있습니다");
      return;
    }
    if (!allowed.has(parsed.hostname)) report(path, `허용 목록에 없는 호스트입니다: ${parsed.hostname}`);
  };
  checkUrl(config.channels.talk.url, ["channels", "talk", "url"]);
  for (const channel of ["naver", "coupang"] as const) {
    for (const [placement, url] of Object.entries(config.channels[channel].urls)) {
      checkUrl(url, ["channels", channel, "urls", placement]);
    }
  }
  config.featuredProducts.forEach((item, index) => checkUrl(item.href, ["featuredProducts", index, "href"]));
}

function checkUniqueIds(items: readonly { readonly id: string }[], section: Path, report: Report): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.id)) report([...section, index, "id"], "같은 id가 이미 있습니다");
    seen.add(item.id);
  });
}

function checkCollections(config: SiteConfig, report: Report): void {
  checkUniqueIds(config.notices, ["notices"], report);
  checkUniqueIds(config.help, ["help"], report);
  checkUniqueIds(config.featuredProducts, ["featuredProducts"], report);
  checkUniqueIds(config.calendar.holidays, ["calendar", "holidays"], report);
  const seenDates = new Set<string>();
  config.calendar.holidays.forEach((period, periodIndex) => {
    period.dates.forEach((date, dateIndex) => {
      if (seenDates.has(date)) report(["calendar", "holidays", periodIndex, "dates", dateIndex], "같은 날짜가 이미 있습니다");
      seenDates.add(date);
    });
  });
  config.featuredProducts.forEach((item, index) => {
    if (!(Date.parse(item.validUntil) > Date.parse(item.validFrom))) report(["featuredProducts", index, "validUntil"], "종료 시각이 시작보다 빠릅니다");
    if (item.priceLabel !== null && item.priceCheckedAt === null) report(["featuredProducts", index, "priceLabel"], "가격에는 확인 시각이 필요합니다");
  });
  config.help.forEach((entry, index) => {
    if (entry.openIn.some((key) => !entry.showIn.includes(key))) {
      report(["help", index, "openIn"], "펼침 상태는 표시 상태 안에서만 고를 수 있습니다");
    }
  });
}

/** superRefine rules for SiteConfigSchema (roadmap §9 invariants + contract addition 13). */
export function checkInvariants(config: SiteConfig, ctx: z.RefinementCtx): void {
  const report: Report = (path, message) => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path], message });
  };
  checkPlacement(config, report);
  checkStateCopy(config, report);
  checkCopyText(config, report);
  checkDurations(config, report);
  checkLookup(config, report);
  checkNotices(config, report);
  checkHosts(config, report);
  checkCollections(config, report);
}
