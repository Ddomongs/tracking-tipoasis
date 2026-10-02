import { expect, test } from "@playwright/test";
import {
  calendar, channels, disclosures, durations, featuredProducts, lookup, resultCopy, siteConfig, stateGuide
} from "@/config/site.config";
import { SiteConfigSchema, formatConfigIssues } from "@/lib/config/schema";
import { GUIDE_KEYS } from "@/lib/tracking/types";
import { FIXTURE_CONFIG, withConfig } from "../fixtures/config-fixtures";
import { FAKE } from "../fixtures/tracking-fixtures";
import { LOOKUP_TIMING } from "@/lib/services/lookup-budget";
import { HOLIDAY_WINDOW_DAYS, getSiteConfig, holidayCoverageWarnings, parseSiteConfig } from "@/lib/config/server";

function issuesOf(value: unknown): string {
  const result = SiteConfigSchema.safeParse(value);
  return result.success ? "" : formatConfigIssues(result.error);
}

const DISCLOSURE_FALLBACK = "쿠팡 링크로 구매하면 운영자가 일정 수수료를 받을 수 있으며 구매 가격에는 영향이 없습니다.";
const DISCLOSURE_APPROVED = "쿠팡 링크는 쿠팡 파트너스 활동의 일환으로, 구매 시 운영자가 수수료를 받습니다.";
const PENDING_RECHECK_FALLBACK = "정보 반영까지 시간이 걸릴 수 있어 2~3시간 뒤 다시 확인해 주세요.";
const HOLIDAYS_2027 = [
  "2027-01-01", "2027-02-06", "2027-02-07", "2027-02-08", "2027-02-09", "2027-03-01", "2027-05-01", "2027-05-03",
  "2027-05-05", "2027-05-13", "2027-06-06", "2027-07-17", "2027-07-19", "2027-08-15", "2027-08-16", "2027-09-14",
  "2027-09-15", "2027-09-16", "2027-10-03", "2027-10-04", "2027-10-09", "2027-10-11", "2027-12-25", "2027-12-27"
];

test.describe("shipped config", () => {
  test("the shipped config and the fixture config parse without issues", () => {
    expect(issuesOf(siteConfig)).toBe("");
    expect(issuesOf(FIXTURE_CONFIG)).toBe("");
  });

  test("stateGuide has exactly one row per guide key", () => {
    expect(Object.keys(stateGuide).sort()).toEqual([...GUIDE_KEYS].sort());
  });

  test("E2E-locked status and CTA headings keep their wording", () => {
    expect(stateGuide.pending.title).toBe("통관 정보 등록 전");
    expect(stateGuide.inTransit.title).toBe("국내 배송 중");
    expect(stateGuide.delivered.title).toBe("배송 완료");
    expect(stateGuide.pickedUp.title).toBe("{carrier} 기사님 픽업 완료!");
    expect(stateGuide.pending.ctaHeading).toBe("아직 국내 배송 정보가 없어요");
    expect(stateGuide.inTransit.ctaHeading).toBe("배송이 진행 중이에요");
    expect(stateGuide.delivered.ctaHeading).toBe("배송이 완료됐어요");
    expect(stateGuide.invalidNumber.title).toBe("번호 형식이 달라요. 숫자 10~14자리 또는 영문 3~4자+숫자예요.");
  });

  test("ETA labels and texts, journey station names and issue marks are the spec's", () => {
    expect([resultCopy.etaLabel, resultCopy.etaTodayLabel, resultCopy.etaOverdueLabel, resultCopy.etaDeliveredLabel])
      .toEqual(["도착 예상", "오늘 예상", "예상했던 날짜", "배송 완료일"]);
    expect(resultCopy.etaPendingText).toBe("정보 등록 후 안내");
    expect(resultCopy.etaWithheldText).toBe("지금은 도착 예상일을 안내하기 어려워요");
    // S05's JourneySpine draws these names as literals (contract §11.11); history segment titles read them from here,
    // so an edit here would make the two disagree. The spec fixes them; this row keeps both sources equal.
    expect([resultCopy.stationDeparted, resultCopy.stationCustoms, resultCopy.stationDomestic, resultCopy.stationArrived])
      .toEqual(["해외 출발", "입항·통관", "국내 배송", "도착"]);
    expect([resultCopy.issueStopped, resultCopy.issueCut, resultCopy.issueBranch]).toEqual(["멈춤", "끊김", "갈림"]);
  });

  test("lookup copy is the spec's", () => {
    expect(lookup.copy.submit).toBe("조회하기");
    expect(lookup.copy.submitting).toBe("조회 중…");
    expect(lookup.copy.title).toBe("조회하고 있어요");
    expect(lookup.copy.body).toBe("관세청 통관 정보와 택배사 배송 정보를 함께 확인해요");
    expect(lookup.copy.started).toBe("조회를 시작했어요");
    expect(lookup.copy.longWait).toBe("해외 화물은 여러 해의 기록을 찾아서 조금 더 걸려요. 보통 10초 안에 끝나요.");
    expect(lookup.copy.veryLongWait).toBe("기록이 없는 번호는 30초 가까이 걸릴 수 있어요. 번호가 맞는지 한 번 봐 주세요.");
    expect(lookup.copy.elapsed).toBe("{seconds}초째");
    expect(lookup.copy.cancel).toBe("조회 취소");
    expect(lookup.copy.carrierOfficialFirst).toBe("택배사 공식 조회로 먼저 보기");
    expect(lookup.copy.formatHint).toBe(
      "숫자 10~14자리 (예: 0000 0000 0000) · 영문 3~4자로 시작하는 HBL (예: ABCD 0000 0000) · 공백·하이픈은 자동으로 빼요"
    );
    expect(lookup.copy.numberFinderSummary).toBe("번호는 어디서 찾나요?");
    expect(lookup.copy.numberFinderItems).toEqual(["네이버 주문상세 → 배송조회", "쿠팡 주문목록 → 배송조회", "톡톡 출고 안내문"]);
    expect(lookup.copy.carrierAuto).toBe("택배사 자동 확인");
    expect(lookup.copy.typicalSummary).toBe("보통 이렇게 걸려요");
  });

  test("lookup timing is the pre-R4 set or the R4 set, and the NOT_FOUND caveat follows it", () => {
    expect(lookup.skeletonDelayMs).toBe(400);
    expect(lookup.spinnerStopMs).toBe(5000);
    expect(lookup.elapsedStepSeconds).toBe(5);
    expect(lookup.rateLimitCooldownSeconds).toBe(10);
    expect(lookup.stageMs[0]).toBe(3000);
    expect([45000, 25000]).toContain(lookup.timeoutMs);
    expect(lookup.notFoundServiceCaveat).toBe(lookup.timeoutMs === 45000);
  });

  test("channels keep the current 톡톡 and store links and the spec labels", () => {
    expect(channels.talk.url).toBe("https://talk.naver.com/ct/w41rsr");
    expect(channels.talk.labels).toEqual({
      header: "문의", shortcut: "톡톡 상담", cta: "톡톡으로 문의하기", copyAndTalk: "문의 내용 복사하고 톡톡 열기", footer: "톡톡 상담"
    });
    expect(channels.naver.urls.showcase).toBe("https://mkt.shopping.naver.com/link/6a0bbf9cc55d142f0519328c");
    expect(channels.coupang.urls.showcase).toBe("https://link.coupang.com/a/d7TbzdnS1s");
    expect([channels.naver.isAffiliate, channels.coupang.isAffiliate]).toEqual([false, true]);
    expect([channels.naver.linkLabel, channels.coupang.linkLabel]).toEqual(["네이버 스토어 보기", "쿠팡 스토어 보기"]);
  });

  test("approval 9: the definitive disclosure wording", () => {
    expect(disclosures.coupang).toBe(DISCLOSURE_APPROVED);
    expect(disclosures.coupang).not.toBe(DISCLOSURE_FALLBACK);
  });

  test("the pending recheck sentence is the current one until approval 4", () => {
    expect(durations.pendingRecheck).toBe(PENDING_RECHECK_FALLBACK);
  });

  test("durations use the §17 Q1 defaults", () => {
    expect(durations.stages).toEqual({
      visibleAfterDeparture: { min: 3, max: 7 }, customs: { min: 1, max: 2 },
      handoffBusinessDays: { min: 0, max: 1 }, domestic: { min: 1, max: 2 }
    });
    expect(durations.worry).toEqual({
      afterEstimateBusinessDays: 1, afterClearanceBusinessDays: 2, notFoundDays: 7, pendingDays: 10, undeliveredHours: 24
    });
    expect(durations.staleDays).toBe(14);
    expect(durations.typical.map((row) => row.station)).toEqual(["departed", "customs", "domestic", "arrived"]);
  });

  test("calendar: KST, no Saturday delivery, the verified 2026 and 2027 holidays", () => {
    expect(calendar.timeZone).toBe("Asia/Seoul");
    expect(calendar.carrierDeliversSaturday).toBe(false);
    const byId = new Map(calendar.holidays.map((period) => [period.id, period]));
    expect(byId.get("2026-chuseok")?.dates).toEqual(["2026-09-24", "2026-09-25", "2026-09-26"]);
    expect(byId.get("2026-chuseok")?.badge).toBe("추석 연휴 영향 · 1~2일 늦어질 수 있어요");
    expect(byId.get("2026-foundation-day")?.dates).toEqual(["2026-10-03", "2026-10-05"]);
    expect(byId.get("2026-hangul-day")?.dates).toEqual(["2026-10-09"]);
    expect(calendar.holidays.flatMap((period) => period.dates).filter((date) => date.startsWith("2027-"))).toEqual(HOLIDAYS_2027);
    const all = calendar.holidays.flatMap((period) => period.dates);
    expect(new Set(all).size).toBe(all.length);
  });

  test("ads and style defaults", () => {
    expect(siteConfig.ads).toEqual({ manualSlotId: null, minHeightMobilePx: 280, minHeightDesktopPx: 250, anchorReservePx: 64 });
    expect(siteConfig.style.followSystemDark).toBe(true);
  });

  test("featured products carry no unverified prices", () => {
    // S03 ships store-home links and no prices. S08 Task 10 (approval 10) may add product-detail links with a price and its
    // check time; a price on a store-home link or without a check time stays forbidden, so that follow-up needs no edit here.
    const storeHomes = new Set<string>([...Object.values(channels.naver.urls), ...Object.values(channels.coupang.urls)]);
    const unverified = featuredProducts.filter(
      (item) => item.priceLabel !== null && (item.priceCheckedAt === null || storeHomes.has(item.href))
    );
    expect(unverified.map((item) => item.id)).toEqual([]);
  });
});

test.describe("fixture config", () => {
  test("withConfig merges objects deeply and replaces arrays", () => {
    const patched = withConfig({ durations: { staleDays: 15 }, notices: [] });
    expect(patched.durations.staleDays).toBe(15);
    expect(patched.durations.worry).toEqual(FIXTURE_CONFIG.durations.worry);
    expect(patched.notices).toEqual([]);
    expect(FIXTURE_CONFIG.durations.staleDays).toBe(14);
  });

  test("fixture notices, holidays and featured items are deterministic", () => {
    expect(FIXTURE_CONFIG.notices.map((notice) => notice.id)).toEqual(["fx-holiday", "fx-outage", "fx-info", "fx-expired"]);
    expect(FIXTURE_CONFIG.calendar.holidays.map((period) => period.id)).toEqual([
      "2026-chuseok", "2026-foundation-day", "2026-hangul-day", "2026-christmas", "2027-seollal"
    ]);
    expect(FIXTURE_CONFIG.featuredProducts.map((item) => item.id)).toEqual(["fx-weekly-mount", "fx-month-case"]);
  });
});

test.describe("Korean issue lines", () => {
  test("a wrong type names the path and the expected type", () => {
    const broken = withConfig({ durations: { staleDays: "14" as unknown as number } });
    expect(issuesOf(broken)).toContain("durations.staleDays: 숫자 형식이어야 합니다");
  });

  test("an unknown top-level key is reported for the whole config", () => {
    expect(issuesOf({ ...FIXTURE_CONFIG, extra: true })).toContain("(설정 전체): 알 수 없는 항목입니다: extra");
  });

  test("a bad enum value lists the allowed values", () => {
    const broken = withConfig({ stateGuide: { stale: { tone: "red" as unknown as "attention" } } });
    expect(issuesOf(broken)).toContain(
      "stateGuide.stale.tone: 허용되지 않은 값입니다(가능한 값: neutral, progress, waiting, attention, problem, done)"
    );
  });

  test("a notice time without +09:00 is rejected", () => {
    const broken = withConfig({ notices: [{ ...FIXTURE_CONFIG.notices[0], startsAt: "2026-09-21T00:00:00Z" }] });
    expect(issuesOf(broken)).toContain("notices[0].startsAt: 시각은 2026-09-26T14:05:00+09:00처럼 +09:00을 붙여 씁니다");
  });

  test("an impossible holiday date is rejected", () => {
    const broken = withConfig({
      calendar: { holidays: [{ id: "x", name: "없는 날", dates: ["2026-02-30"], badge: "없는 날 영향 · 1일 늦어질 수 있어요" }] }
    });
    expect(issuesOf(broken)).toContain("calendar.holidays[0].dates[0]: 날짜는 2026-09-24처럼 있는 날짜를 YYYY-MM-DD로 씁니다");
  });

  test("a blank required text is rejected", () => {
    expect(issuesOf(withConfig({ resultCopy: { etaLabel: " " } }))).toContain("resultCopy.etaLabel: 빈 문구입니다");
  });
});

test.describe("config invariants", () => {
  test("problem states and loading carry no stores, recommendations or ads", () => {
    const issues = issuesOf(withConfig({
      stateGuide: {
        stale: { stores: "ctaLead" }, serverError: { revenueTier: "quiet" },
        ambiguous: { recommendations: "inline" }, loading: { stores: "shortcutRow" }
      }
    }));
    expect(issues).toContain("stateGuide.stale.stores: 문제 상태에는 스토어를 둘 수 없습니다");
    expect(issues).toContain("stateGuide.serverError.revenueTier: 문제 상태에는 광고를 둘 수 없습니다");
    expect(issues).toContain("stateGuide.ambiguous.recommendations: 문제 상태에는 추천 상품을 둘 수 없습니다");
    expect(issues).toContain("stateGuide.loading.stores: 조회 중에는 스토어를 둘 수 없습니다");
  });

  test("in transit shows no stores", () => {
    expect(issuesOf(withConfig({ stateGuide: { inTransit: { stores: "ctaLead" } } })))
      .toContain("stateGuide.inTransit.stores: 배송 중에는 스토어를 둘 수 없습니다");
  });

  test("delivered leads with the stores", () => {
    const issues = issuesOf(withConfig({ stateGuide: { delivered: { stores: "none", primaryAction: "none" } } }));
    expect(issues).toContain("stateGuide.delivered.stores: 배송 완료는 스토어가 먼저 와야 합니다");
    expect(issues).toContain("stateGuide.delivered.primaryAction: 배송 완료는 스토어가 먼저 와야 합니다");
  });

  test("pending offers inquiry and purchase choices", () => {
    const issues = issuesOf(withConfig({ stateGuide: { pending: { stores: "none", inquiryLevel: "textLink" } } }));
    expect(issues).toContain("stateGuide.pending.stores: 국내 도착 전에는 구매처 선택지가 있어야 합니다");
    expect(issues).toContain("stateGuide.pending.inquiryLevel: 국내 도착 전에는 문의 버튼이 있어야 합니다");
  });

  test("affiliate links need the disclosure; without affiliate links it may be empty", () => {
    expect(issuesOf(withConfig({ disclosures: { coupang: " " } })))
      .toContain("disclosures.coupang: 제휴 링크에는 고지 문구가 필요합니다");
    expect(issuesOf(withConfig({ disclosures: { coupang: "" }, channels: { coupang: { isAffiliate: false } }, featuredProducts: [] })))
      .not.toContain("disclosures.coupang");
  });

  test("copy with a real-looking number, an HBL token or AI wording fails", () => {
    const notice = { ...FIXTURE_CONFIG.notices[0], body: `택배 ${FAKE.domestic} 확인해 주세요` };
    const helpEntry = { ...FIXTURE_CONFIG.help[0], body: ["안내", `${FAKE.hbl} 확인`] };
    const issues = issuesOf(withConfig({
      notices: [notice],
      help: [helpEntry],
      stateGuide: { inTransit: { reason: "AI가 위치를 알려 드려요" } },
      resultCopy: { carrierCutLine: "배송 로봇이 늦어요" }
    }));
    expect(issues).toContain("notices[0].body: 10자리 이상 숫자를 쓸 수 없습니다");
    expect(issues).toContain("help[0].body[1]: HBL 형식 번호를 쓸 수 없습니다");
    expect(issues).toContain("stateGuide.inTransit.reason: AI·인공지능·로봇·봇 표현을 쓸 수 없습니다");
    expect(issues).toContain("resultCopy.carrierCutLine: AI·인공지능·로봇·봇 표현을 쓸 수 없습니다");
  });

  test("all-zero placeholders, clock times and short digit runs are allowed", () => {
    const notice = { ...FIXTURE_CONFIG.notices[0], body: "예: 0000 0000 0000 · 22:00~24:00 점검 · 1~2일" };
    expect(issuesOf(withConfig({ notices: [notice] }))).toBe("");
  });

  test("stateGuide copy uses only the five tokens; other copy uses none or its fixed slots", () => {
    const issues = issuesOf(withConfig({
      stateGuide: { customsWaiting: { worry: "{orderId}에 {worryDate}까지 그대로면 알려 주세요" } },
      notices: [{ ...FIXTURE_CONFIG.notices[0], title: "{etaDate} 안내" }],
      resultCopy: { historySummary: "처리 내역 보기", actionRetry: "{carrier} 다시 조회" },
      lookup: { copy: { elapsed: "경과" } }
    }));
    expect(issues).toContain("stateGuide.customsWaiting.worry: 허용되지 않은 토큰 {orderId}입니다");
    expect(issues).toContain("notices[0].title: 이 문구에는 토큰을 쓸 수 없습니다");
    expect(issues).toContain("resultCopy.historySummary: {n} 자리가 필요합니다");
    expect(issues).toContain("resultCopy.actionRetry: 허용되지 않은 토큰 {carrier}입니다");
    expect(issues).toContain("lookup.copy.elapsed: {seconds} 자리가 필요합니다");
  });

  test("a malformed token (underscore, spaces, Hangul, a stray brace) fails instead of reaching customers", () => {
    const issues = issuesOf(withConfig({
      stateGuide: { customsWaiting: { worry: "{worry_date}까지 그대로면 알려 주세요" }, pending: { reason: "{ worryDate } 안내" } },
      resultCopy: { etaPendingText: "{날짜}에 안내" },
      notices: [{ ...FIXTURE_CONFIG.notices[0], body: "점검 중이에요 }" }]
    }));
    expect(issues).toContain("stateGuide.customsWaiting.worry: 중괄호 {…} 모양이 잘못됐습니다");
    expect(issues).toContain("stateGuide.pending.reason: 중괄호 {…} 모양이 잘못됐습니다");
    expect(issues).toContain("resultCopy.etaPendingText: 중괄호 {…} 모양이 잘못됐습니다");
    expect(issues).toContain("notices[0].body: 중괄호 {…} 모양이 잘못됐습니다");
  });

  test("staleDays must equal the server's 14", () => {
    expect(issuesOf(withConfig({ durations: { staleDays: 15 } })))
      .toContain("durations.staleDays: 서버 기준(14일)과 같아야 합니다");
  });

  test("notice limits, windows and ids", () => {
    const base = FIXTURE_CONFIG.notices[0];
    const issues = issuesOf(withConfig({
      notices: [
        { ...base, id: "a", title: "가".repeat(21) },
        { ...base, id: "b", body: "나".repeat(81) },
        { ...base, id: "c", startsAt: "2026-09-29T00:00:00+09:00", endsAt: "2026-09-21T00:00:00+09:00" },
        { ...base, id: "c" }
      ]
    }));
    expect(issues).toContain("notices[0].title: 제목은 20자 이하여야 합니다");
    expect(issues).toContain("notices[1].body: 본문은 80자 이하여야 합니다");
    expect(issues).toContain("notices[2].endsAt: 종료 시각이 시작보다 빠릅니다");
    expect(issues).toContain("notices[3].id: 같은 id가 이미 있습니다");
    expect(issuesOf(withConfig({ notices: [{ ...base, title: "가".repeat(20), body: "나".repeat(80) }] }))).toBe("");
  });

  test("links must be https on an allowed host", () => {
    const issues = issuesOf(withConfig({
      channels: {
        naver: { urls: { pending: "http://mkt.shopping.naver.com/link/x" } },
        coupang: { urls: { deliveredLead: "https://example.com/x" } }
      }
    }));
    expect(issues).toContain("channels.naver.urls.pending: https 주소만 쓸 수 있습니다");
    expect(issues).toContain("channels.coupang.urls.deliveredLead: 허용 목록에 없는 호스트입니다: example.com");
  });

  test("overdue titles exist exactly for the six progress states, with a {worryDate} worry line", () => {
    const issues = issuesOf(withConfig({
      stateGuide: {
        customsWaiting: { overdueTitle: null },
        delivered: { overdueTitle: "{worryDate}이 지났어요" },
        inTransit: { worry: "곧 도착해요" }
      }
    }));
    expect(issues).toContain("stateGuide.customsWaiting.overdueTitle: 기준일이 지난 상태의 제목이 필요합니다");
    expect(issues).toContain("stateGuide.delivered.overdueTitle: 이 상태에는 기준일 경과 제목을 쓸 수 없습니다");
    expect(issues).toContain("stateGuide.inTransit.worry: {worryDate} 자리가 필요합니다");
  });

  test("day counts in the copy follow the durations", () => {
    const issues = issuesOf(withConfig({
      durations: { worry: { notFoundDays: 5, pendingDays: 12 }, stages: { visibleAfterDeparture: { min: 2, max: 6 } } }
    }));
    expect(issues).toContain("stateGuide.notFound.worry: 걱정 기준(5일)과 문구가 다릅니다");
    expect(issues).toContain("stateGuide.pending.worry: 걱정 기준(12일)과 문구가 다릅니다");
    expect(issues).toContain("stateGuide.notFound.reason: 조회 가능 시점(2~6일)과 문구가 다릅니다");
  });

  test("state-table sanity rules", () => {
    const issues = issuesOf(withConfig({
      stateGuide: {
        stale: { tone: "problem", etaMode: "estimate" },
        customsWaiting: { primaryAction: "copyAndTalk" },
        pending: { etaMode: "estimate" },
        customsCleared: { docTitle: "통관 {carrier} 완료" }
      }
    }));
    expect(issues).toContain("stateGuide.stale.tone: 빨간 톤은 오류 상태에만 쓸 수 있습니다");
    expect(issues).toContain("stateGuide.stale.etaMode: 정체 상태는 예상일 대신 확인 안내를 보여야 합니다");
    expect(issues).toContain("stateGuide.customsWaiting.primaryAction: 정상 대기 상태에는 채움 버튼을 둘 수 없습니다");
    expect(issues).toContain("stateGuide.pending.etaMode: 국내 도착 전에는 '정보 등록 후 안내'를 보여야 합니다");
    expect(issues).toContain("stateGuide.customsCleared.docTitle: 문서 제목에는 숫자나 토큰을 쓸 수 없습니다");
  });

  test("lookup timings must increase", () => {
    expect(issuesOf(withConfig({ lookup: { stageMs: [9000, 8000] } })))
      .toContain("lookup.stageMs: 단계 시각은 스켈레톤 < 긴 대기 < 아주 긴 대기 < 제한 시간 순서여야 합니다");
    expect(issuesOf(withConfig({ lookup: { spinnerStopMs: 60000 } })))
      .toContain("lookup.spinnerStopMs: 스피너 정지 시각은 제한 시간보다 빨라야 합니다");
  });

  test("the S10 Part B values are accepted", () => {
    expect(issuesOf(withConfig({ lookup: { timeoutMs: 25000, notFoundServiceCaveat: false, stageMs: [3000, 7000] } }))).toBe("");
  });

  test("featured items, help entries and holiday ids", () => {
    const late = { ...FIXTURE_CONFIG.featuredProducts[0], validUntil: "2026-09-20T00:00:00+09:00" };
    const unchecked = { ...FIXTURE_CONFIG.featuredProducts[1], priceCheckedAt: null };
    const helpEntry = { ...FIXTURE_CONFIG.help[0], openIn: ["delivered" as const] };
    const [first, second] = FIXTURE_CONFIG.calendar.holidays;
    const issues = issuesOf(withConfig({
      featuredProducts: [late, unchecked],
      help: [helpEntry],
      calendar: { holidays: [first, { ...second, id: first.id }] }
    }));
    expect(issues).toContain("featuredProducts[0].validUntil: 종료 시각이 시작보다 빠릅니다");
    expect(issues).toContain("featuredProducts[1].priceLabel: 가격에는 확인 시각이 필요합니다");
    expect(issues).toContain("help[0].openIn: 펼침 상태는 표시 상태 안에서만 고를 수 있습니다");
    expect(issues).toContain("calendar.holidays[1].id: 같은 id가 이미 있습니다");
  });
});

test.describe("server access", () => {
  test("getSiteConfig parses once and returns the shipped values", () => {
    const first = getSiteConfig();
    expect(first).toEqual(siteConfig);
    expect(getSiteConfig()).toBe(first);
  });

  test("parseSiteConfig throws with one Korean line per problem", () => {
    expect(() => parseSiteConfig(withConfig({ durations: { staleDays: 15 } })))
      .toThrow("config/site.config.ts 설정 오류\ndurations.staleDays: 서버 기준(14일)과 같아야 합니다");
  });

  test("holiday coverage warns once per year without data in the next 60 days", () => {
    expect(HOLIDAY_WINDOW_DAYS).toBe(60);
    expect(holidayCoverageWarnings(FIXTURE_CONFIG, new Date("2026-09-26T14:05:00+09:00"))).toEqual([]);
    expect(holidayCoverageWarnings(FIXTURE_CONFIG, new Date("2027-11-15T09:00:00+09:00"))).toEqual([
      "calendar.holidays: 2028년 공휴일이 없습니다. 2028-01-01부터 걱정 기준일 계산에서 공휴일이 빠집니다. 월력요항을 보고 추가해 주세요."
    ]);
    expect(holidayCoverageWarnings(withConfig({ calendar: { holidays: [] } }), new Date("2026-12-10T09:00:00+09:00"))).toEqual([
      "calendar.holidays: 2026년 공휴일이 없습니다. 2026-12-10부터 걱정 기준일 계산에서 공휴일이 빠집니다. 월력요항을 보고 추가해 주세요.",
      "calendar.holidays: 2027년 공휴일이 없습니다. 2027-01-01부터 걱정 기준일 계산에서 공휴일이 빠집니다. 월력요항을 보고 추가해 주세요."
    ]);
  });

  test("the shipped holidays cover the 60 days after the stage date", () => {
    expect(holidayCoverageWarnings(siteConfig, new Date("2026-09-26T14:05:00+09:00"))).toEqual([]);
  });
});

test("the noscript notice (S06) is one plain customer sentence pair", () => {
  expect(lookup.copy.noscriptNotice).toBe("자바스크립트가 꺼져 있어 조회 결과를 보여 드릴 수 없어요. 브라우저 설정에서 켠 뒤 다시 열어 주세요.");
});

test.describe("R4 client lookup timing (S10 Part B)", () => {
  test("the client timeout is 25 s once the server budget is live", () => {
    expect(lookup.timeoutMs).toBe(25_000);
  });

  test("the client timeout outlasts the server budget by at least 5 s", () => {
    expect(lookup.timeoutMs - LOOKUP_TIMING.budgetMs).toBeGreaterThanOrEqual(5_000);
  });

  test("the NOT_FOUND service caveat is off after the server fix", () => {
    expect(lookup.notFoundServiceCaveat).toBe(false);
  });

  test("stage bounds increase and the very-long stage starts before the server budget ends", () => {
    const [longStage, veryLongStage] = lookup.stageMs;
    expect(longStage).toBeGreaterThanOrEqual(lookup.skeletonDelayMs);
    expect(veryLongStage).toBeGreaterThan(longStage);
    expect(veryLongStage).toBeGreaterThanOrEqual(6_000);
    expect(veryLongStage).toBeLessThanOrEqual(10_000);
    expect(veryLongStage).toBeLessThan(LOOKUP_TIMING.budgetMs);
    expect(lookup.spinnerStopMs).toBeLessThan(veryLongStage);
  });
});
