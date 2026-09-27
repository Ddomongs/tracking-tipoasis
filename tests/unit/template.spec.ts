import { expect, test } from "@playwright/test";
import { COPY_TOKENS, fillCopy, fillSlots, tokensIn } from "@/lib/tracking/template";

test("stateGuide copy may use exactly five tokens", () => {
  expect([...COPY_TOKENS]).toEqual(["etaDate", "worryDate", "lastEventDate", "carrier", "staleDays"]);
});

test("tokensIn lists tokens in order, repeats included", () => {
  expect(tokensIn("{worryDate}까지 {carrier} {worryDate}")).toEqual(["worryDate", "carrier", "worryDate"]);
  expect(tokensIn("토큰 없음")).toEqual([]);
});

test("fillCopy resolves known tokens and blanks missing or unknown ones", () => {
  expect(fillCopy("{carrier} 기사님 픽업 완료!", { carrier: "CJ대한통운" })).toBe("CJ대한통운 기사님 픽업 완료!");
  expect(fillCopy("{worryDate}까지 그대로면 알려 주세요", {})).toBe("까지 그대로면 알려 주세요");
  expect(fillCopy("{orderId} 확인", { carrier: "CJ대한통운" })).toBe(" 확인");
});

test("fillSlots fills the non-stateGuide slots", () => {
  expect(fillSlots("처리 내역 {n}건 보기", { n: "11" })).toBe("처리 내역 11건 보기");
  expect(fillSlots("{seconds}초째", { seconds: "13" })).toBe("13초째");
});

test("braces without a token name stay untouched", () => {
  expect(fillSlots("{ } {1}", {})).toBe("{ } {1}");
});
