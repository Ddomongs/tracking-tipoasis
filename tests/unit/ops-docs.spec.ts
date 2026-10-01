import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/** Structure checks for the operator documents S11 writes (roadmap §10.5). The repo guard (S01) checks their digits. */
const read = (relative: string): string => readFileSync(path.join(process.cwd(), relative), "utf8");

function expectAll(document: string, needles: readonly string[]): void {
  const text = read(document);
  for (const needle of needles) expect(text, `${document} must contain: ${needle}`).toContain(needle);
}

/** Status of an approval row in the roadmap ledger (§4): approved | pending | rejected. */
function ledgerStatus(approval: number): string {
  const ledger = read("docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md");
  const status = new RegExp(`^\\| ${approval} \\| [^|]+\\| (\\w+)[^|]*\\|`, "m").exec(ledger)?.[1];
  expect(status, `approval ${approval} row not found in roadmap §4`).toBeTruthy();
  return status ?? "";
}

test.describe("operator documents (S11)", () => {
  test("the observability baseline has the routes, codes, 30 % rule and the weekly 톡톡 sheet", () => {
    expectAll("docs/ops/observability-baseline.md", [
      "최소 2주",
      "`/`",
      "`/[trackingNumber]`",
      "`/api/track`",
      "200, 400, 404, 429, 5xx",
      "딥링크 비중",
      "30 % 이상",
      "30 % 미만",
      "위치·언제 와요",
      "통관 지연·정체",
      "번호·조회 안 됨",
      "미수령",
      "개인통관고유부호",
      "기타",
      "조회 화면을 보고도 문의했는지",
      "저장소에 넣지 않고",
      "주간 기록 표",
      "판정 기록"
    ]);
  });
});

test.describe("operator documents, R5 (S11)", () => {
  test("the KPI dashboard defines the seven KPIs with both sources and the 15 % rule", () => {
    expectAll("docs/ops/kpi-dashboard.md", [
      "조회당 문의",
      "정상 대기 3상태의 톡톡 클릭률",
      "문제 상태 톡톡 중 문의 내용 복사 비율",
      "같은 탭 10분 안 재조회",
      "결과 대기 버킷",
      "delivered 스토어 클릭률과 '/' RPM",
      "필드 LCP·INP·CLS p75",
      "대체 출처",
      "`lookup_start`",
      "`lookup_settle`",
      "`lookup_error`",
      "`action`",
      "`details_open`",
      "`notice_view`",
      "`style_select`",
      "절반",
      "50 % 이상",
      "25초 초과 1 % 미만",
      "LCP 2.5초 이하, INP 200ms 이하, CLS 0.05 이하",
      "15 %",
      "`AD_TIMING_POLICY`",
      "`\"afterScrub\"`",
      "`\"neverOnNumberRoutes\"`",
      "Web Analytics를",
      "속성을 최대 2개"
    ]);
  });

  test("the AdSense checklist follows approval 15 and keeps the different-week rule", () => {
    const document = "docs/ops/adsense-settings-checklist.md";
    expectAll(document, ["비네트", "추가 트리거를 끕니다", "R1(후보 B) 배포 주와도, R3(새 화면) 배포 주와도 다른 주", "적용 기록"]);
    const text = read(document);
    const fullList = [
      "데스크톱 앵커를 끄고",
      "모바일 앵커는 하단 위치만",
      "페이지 내 광고(in-page): 끕니다",
      "데스크톱 왼쪽만",
      "`ads.manualSlotId`",
      "`/internal`로 시작하는 주소를 제외"
    ];
    if (ledgerStatus(15) === "approved") {
      for (const item of fullList) expect(text, item).toContain(item);
    } else {
      expect(text).toContain("'거절하면'");
      for (const item of fullList) expect(text, item).not.toContain(item);
    }
  });

  test("the strict CSP decision record follows approval 16", () => {
    const document = "docs/ops/strict-csp-decision.md";
    expectAll(document, ["## 배경", "## 선택지", "## 관찰 자료(결정 전 2주)", "## 결정", "`csp_report", "`documentKind`"]);
    const text = read(document);
    if (ledgerStatus(16) === "approved") {
      expect(text).toContain("A안 채택");
      expect(text).toContain("`proxy.ts` 변경에 대한 운영자 승인");
      expect(text).not.toContain("C안: 1단계 헤더를 유지합니다");
    } else {
      expect(text).toContain("C안: 1단계 헤더를 유지합니다(스펙 §16 항목 16 '거절하면')");
      expect(text).not.toContain("A안 채택");
    }
  });

  test("the WAF proposal limits /internal and the report endpoint per IP, log first", () => {
    expectAll("docs/ops/waf-internal-proposal.md", [
      "`proxy.ts`",
      "401",
      "Starts with, `/internal`",
      "Equals, `/api/csp-report`",
      "Fixed Window, 창 60초, 기준 IP",
      "넘으면 429",
      "먼저 동작을 Log로",
      "## 되돌리기"
    ]);
  });
});
