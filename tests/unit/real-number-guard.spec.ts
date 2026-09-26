import { expect, test } from "@playwright/test";
import {
  DIGIT_RUN_PATTERN,
  HBL_LIKE_PATTERN,
  containsTrackingLikeValue,
  decodeRepeatedly,
  findDisallowedDigitRuns,
  isAllowedDigitRun
} from "@/lib/privacy/number-patterns";
import { ADSENSE_CLIENT_ID, ADSENSE_LOADER_URL, ADSENSE_PUBLISHER_DIGITS } from "@/lib/site";
import { FAKE, FAKE_GROUPED } from "../fixtures/tracking-fixtures";

// Non-fixture values are assembled at runtime so that this file never contains a disallowed run itself.
const NINES_12 = "9".repeat(12);
const NINES_GROUPED = ["9999", "9999", "9999"].join(" ");
const REAL_LOOKING_MOBILE = ["010", "9876", "5432"].join("-");
const DATE_HOUR_DIGITS = ["2026", "0926", "14"].join("");
const IMPOSSIBLE_TIMESTAMP = ["2026", "1399", "250000"].join("");
const FORMAT_HINT =
  "숫자 10~14자리 (예: 0000 0000 0000) · 영문 3~4자로 시작하는 HBL (예: ABCD 0000 0000) · 공백·하이픈은 자동으로 빼요";

const matchesOf = (pattern: RegExp, text: string): string[] =>
  Array.from(text.matchAll(new RegExp(pattern.source, "g")), (match) => match[0]);

test.describe("number patterns (contract §11.4)", () => {
  test("DIGIT_RUN_PATTERN takes 10+ digits joined by single spaces or hyphens", () => {
    expect(DIGIT_RUN_PATTERN.flags).toContain("g");
    expect(matchesOf(DIGIT_RUN_PATTERN, `a ${FAKE_GROUPED.domestic} b`)).toEqual([FAKE_GROUPED.domestic]);
    expect(matchesOf(DIGIT_RUN_PATTERN, "0000-1234-5678")).toEqual(["0000-1234-5678"]);
    expect(matchesOf(DIGIT_RUN_PATTERN, "000 000 000")).toEqual([]);
    expect(matchesOf(DIGIT_RUN_PATTERN, "0000  1234  5678")).toEqual([]);
  });

  test("HBL_LIKE_PATTERN takes 3–4 letters plus 8–16 digits, not inside a longer run", () => {
    expect(HBL_LIKE_PATTERN.flags).toContain("g");
    expect(matchesOf(HBL_LIKE_PATTERN, `q=${FAKE.hbl}&x=1`)).toEqual([FAKE.hbl]);
    expect(matchesOf(HBL_LIKE_PATTERN, FAKE.hbl.toLowerCase())).toEqual([FAKE.hbl.toLowerCase()]);
    expect(matchesOf(HBL_LIKE_PATTERN, `X${FAKE.hbl}`)).toEqual([]);
    expect(matchesOf(HBL_LIKE_PATTERN, `${FAKE.hbl}X`)).toEqual([]);
    expect(matchesOf(HBL_LIKE_PATTERN, "TEST0000000")).toEqual([]);
    expect(matchesOf(HBL_LIKE_PATTERN, FAKE_GROUPED.hblAlt)).toEqual([]);
  });

  test("the repository allowlist keeps fixtures, the AdSense id, timestamps and the fake mobile", () => {
    for (const value of Object.values(FAKE)) expect(findDisallowedDigitRuns(value), value).toEqual([]);
    expect(isAllowedDigitRun(ADSENSE_PUBLISHER_DIGITS)).toBe(true);
    expect(findDisallowedDigitRuns(ADSENSE_CLIENT_ID)).toEqual([]);
    expect(isAllowedDigitRun("20260926140500")).toBe(true);
    expect(isAllowedDigitRun(IMPOSSIBLE_TIMESTAMP)).toBe(false);
    expect(isAllowedDigitRun(FAKE.phone)).toBe(true);
    expect(isAllowedDigitRun(REAL_LOOKING_MOBILE)).toBe(false);
    expect(isAllowedDigitRun(NINES_12)).toBe(false);
    expect(isAllowedDigitRun(NINES_12, [NINES_12])).toBe(true);
  });

  test("findDisallowedDigitRuns returns the raw runs in document order", () => {
    expect(findDisallowedDigitRuns(`a ${NINES_GROUPED} b ${FAKE.domestic} c ${NINES_12}`)).toEqual([NINES_GROUPED, NINES_12]);
  });

  test("a date followed by an hour is not a tracking number; the same digits without separators are", () => {
    expect(findDisallowedDigitRuns("최종 업데이트: 2026-09-26 14:05")).toEqual([]);
    expect(findDisallowedDigitRuns(`최종 업데이트: ${DATE_HOUR_DIGITS}`)).toEqual([DATE_HOUR_DIGITS]);
  });

  test("containsTrackingLikeValue is strict: fixtures count, placeholders and the AdSense id do not", () => {
    expect(containsTrackingLikeValue(FORMAT_HINT)).toBe(false);
    expect(containsTrackingLikeValue(ADSENSE_LOADER_URL)).toBe(false);
    expect(containsTrackingLikeValue(`https://example.com/?u=${FAKE.domestic}`)).toBe(true);
    expect(containsTrackingLikeValue(`/p/${encodeURIComponent(encodeURIComponent(FAKE_GROUPED.domestic))}`)).toBe(true);
    expect(containsTrackingLikeValue(`q=${FAKE_GROUPED.domestic.replace(/ /g, "+")}`)).toBe(true);
    expect(containsTrackingLikeValue(`ref=%2F${FAKE.hbl}`)).toBe(true);
    expect(containsTrackingLikeValue(`title=${FAKE.hbl.toLowerCase()}`)).toBe(true);
    expect(containsTrackingLikeValue("dt=12&ms=345")).toBe(false);
  });

  test("decodeRepeatedly peels nested encoding and survives malformed escapes", () => {
    expect(decodeRepeatedly(encodeURIComponent(encodeURIComponent("a b")))).toBe("a b");
    expect(decodeRepeatedly(`%E0%A4%A ${encodeURIComponent(FAKE_GROUPED.domestic)}`)).toBe(
      `%E0%A4%A ${FAKE_GROUPED.domestic}`
    );
  });
});
