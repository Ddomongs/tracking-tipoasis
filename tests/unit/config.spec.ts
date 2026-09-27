import { expect, test } from "@playwright/test";
import {
  calendar, channels, disclosures, durations, featuredProducts, lookup, resultCopy, siteConfig, stateGuide
} from "@/config/site.config";
import { SiteConfigSchema, formatConfigIssues } from "@/lib/config/schema";
import { GUIDE_KEYS } from "@/lib/tracking/types";
import { FIXTURE_CONFIG, withConfig } from "../fixtures/config-fixtures";

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

  test("the disclosure is the current wording until approval 9, then the approved wording", () => {
    expect([DISCLOSURE_FALLBACK, DISCLOSURE_APPROVED]).toContain(disclosures.coupang);
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
