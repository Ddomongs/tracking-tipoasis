import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/** Structure checks for the operator documents S11 writes (roadmap §10.5). The repo guard (S01) checks their digits. */
const read = (relative: string): string => readFileSync(path.join(process.cwd(), relative), "utf8");

function expectAll(document: string, needles: readonly string[]): void {
  const text = read(document);
  for (const needle of needles) expect(text, `${document} must contain: ${needle}`).toContain(needle);
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
