import { expect, test } from "@playwright/test";
import {
  classifyDeepLink,
  detectConfusables,
  extractFromPastedText,
  MAX_NUMBER_LENGTH,
  normalizeInput,
  parseCarrierParam,
  pasteCarrierNotice,
  precheckNumber
} from "@/lib/tracking/number-input";
import { FAKE, FAKE_GROUPED } from "../fixtures/tracking-fixtures";

/** '!'…'~' → their full-width forms (U+FF01…U+FF5E); spaces stay as they are. */
const toFullWidth = (value: string): string =>
  value.replace(/[!-~]/g, (character) => String.fromCharCode(character.charCodeAt(0) + 0xfee0));

const O_MESSAGE = "영문 O가 섞여 있어요. 숫자 0인가요?";
const IL_MESSAGE = "영문 I나 l이 섞여 있어요. 숫자 1인가요?";

test.describe("normalizeInput", () => {
  test("removes spaces and hyphens, converts full-width characters and uppercases", () => {
    expect(normalizeInput(`  ${FAKE_GROUPED.domestic}  `)).toBe(FAKE.domestic);
    expect(normalizeInput(FAKE_GROUPED.domestic.replaceAll(" ", "-"))).toBe(FAKE.domestic);
    expect(normalizeInput(FAKE_GROUPED.domestic.replaceAll(" ", "–"))).toBe(FAKE.domestic);
    expect(normalizeInput(FAKE_GROUPED.domestic.replaceAll(" ", "　"))).toBe(FAKE.domestic);
    expect(normalizeInput(toFullWidth(FAKE_GROUPED.hbl.toLowerCase()))).toBe(FAKE.hbl);
    expect(normalizeInput(toFullWidth(FAKE_GROUPED.domestic.replaceAll(" ", "-")))).toBe(FAKE.domestic);
    expect(normalizeInput("")).toBe("");
  });
});

test.describe("precheckNumber", () => {
  test("accepts every fixture format and returns the normalized number", () => {
    for (const value of [
      FAKE.domestic,
      FAKE.domesticAlt,
      FAKE.domestic10,
      FAKE.domestic14,
      FAKE.cargo,
      FAKE.hbl,
      FAKE.hblAlt,
      FAKE_GROUPED.domestic,
      FAKE.hbl.toLowerCase(),
      toFullWidth(FAKE.domestic)
    ]) {
      expect(precheckNumber(value), value).toEqual({ ok: true, number: normalizeInput(value) });
    }
  });

  test("names the reason and a one-line diagnosis for every other input", () => {
    expect(precheckNumber("   ")).toEqual({ ok: false, reason: "empty", diagnosis: "조회번호를 넣어 주세요" });
    expect(precheckNumber(FAKE.invalidShort)).toEqual({ ok: false, reason: "tooShort", diagnosis: "지금 5자리예요" });
    expect(precheckNumber(FAKE.invalidConfusable)).toEqual({
      ok: false,
      reason: "confusableLetter",
      diagnosis: `입력하신 값: 0000-0000-00O0 → ${O_MESSAGE}`
    });
    expect(precheckNumber("TEST0000")).toEqual({ ok: false, reason: "tooShort", diagnosis: "영문 뒤 숫자가 지금 4자리예요" });
    expect(precheckNumber(`TEST${"0".repeat(17)}`)).toEqual({
      ok: false,
      reason: "badFormat",
      diagnosis: "영문 뒤 숫자가 지금 17자리예요. 8~16자리여야 해요"
    });
    expect(precheckNumber(FAKE.deepLinkInvalid)).toEqual({
      ok: false,
      reason: "badFormat",
      diagnosis: "영문은 번호 앞에 3~4자만 올 수 있어요"
    });
    expect(precheckNumber("0000#1234")).toEqual({ ok: false, reason: "badFormat", diagnosis: "숫자와 영문만 넣을 수 있어요" });
    expect(precheckNumber("0".repeat(MAX_NUMBER_LENGTH + 1))).toEqual({
      ok: false,
      reason: "tooLong",
      diagnosis: "지금 31자예요. 30자까지 넣을 수 있어요"
    });
  });
});

test.describe("detectConfusables", () => {
  test("suggests the digit when a letter O, I or l makes an otherwise valid number", () => {
    expect(detectConfusables(normalizeInput(FAKE.invalidConfusable))).toEqual({
      kind: "letterO",
      suggestion: "000000000000",
      message: O_MESSAGE
    });
    expect(detectConfusables("TEST0000O001")).toEqual({ kind: "letterO", suggestion: FAKE.hbl, message: O_MESSAGE });
    expect(detectConfusables("TESTO0000001")).toEqual({ kind: "letterO", suggestion: FAKE.hbl, message: O_MESSAGE });
    expect(detectConfusables(normalizeInput("0000i2345678"))).toEqual({
      kind: "letterIl",
      suggestion: FAKE.domestic,
      message: IL_MESSAGE
    });
    expect(detectConfusables(normalizeInput("0000l2345678"))).toEqual({
      kind: "letterIl",
      suggestion: FAKE.domestic,
      message: IL_MESSAGE
    });
  });

  test("stays silent for valid numbers, real HBL prefixes and hopeless input", () => {
    expect(detectConfusables(FAKE.hbl)).toBeNull();
    expect(detectConfusables("OLIV00000001")).toBeNull();
    expect(detectConfusables(FAKE.deepLinkInvalid)).toBeNull();
    expect(detectConfusables("0000O")).toBeNull();
    expect(detectConfusables("")).toBeNull();
  });
});

test.describe("classifyDeepLink", () => {
  test("valid numbers in every spelling the server may receive", () => {
    const rows: ReadonlyArray<readonly [string, string]> = [
      [FAKE.domestic, FAKE.domestic],
      [FAKE_GROUPED.domestic, FAKE.domestic],
      [FAKE_GROUPED.domestic.replaceAll(" ", "-"), FAKE.domestic],
      [toFullWidth(FAKE.domestic), FAKE.domestic],
      [` ${FAKE.domestic} `, FAKE.domestic],
      [FAKE.hbl.toLowerCase(), FAKE.hbl],
      [FAKE.cargo, FAKE.cargo]
    ];
    for (const [segment, number] of rows) {
      expect(classifyDeepLink(segment), segment).toEqual({ kind: "valid", number });
    }
  });

  test("alphanumeric 6–30 characters that are not a number are INVALID", () => {
    expect(classifyDeepLink(FAKE.deepLinkInvalid)).toEqual({ kind: "invalid", input: "ABCDE1" });
    expect(classifyDeepLink(FAKE.deepLinkInvalid.toLowerCase())).toEqual({ kind: "invalid", input: "ABCDE1" });
    expect(classifyDeepLink("0000000000O0")).toEqual({ kind: "invalid", input: "0000000000O0" });
  });

  test("everything else is a real 404", () => {
    for (const segment of ["a.b", "robots.txt", "한글", "ABCDE", "0".repeat(31), "", "0000/1234", "%", "0000_1234_5678"]) {
      expect(classifyDeepLink(segment), segment).toEqual({ kind: "notFound" });
    }
  });
});

test.describe("parseCarrierParam", () => {
  test("accepts the five carrier codes in any case and falls back to AUTO", () => {
    expect(parseCarrierParam("CJ")).toBe("CJ");
    expect(parseCarrierParam(" hanjin ")).toBe("HANJIN");
    expect(parseCarrierParam(["LOTTE", "CJ"])).toBe("LOTTE");
    expect(parseCarrierParam("EPOST")).toBe("EPOST");
    expect(parseCarrierParam("logen")).toBe("LOGEN");
    expect(parseCarrierParam("AUTO")).toBe("AUTO");
    expect(parseCarrierParam("NOPE")).toBe("AUTO");
    expect(parseCarrierParam([])).toBe("AUTO");
    expect(parseCarrierParam(undefined)).toBe("AUTO");
  });
});

const WAYBILL_HYPHENS = FAKE_GROUPED.domestic.replaceAll(" ", "-");
/** An order number shaped like Naver's 16-digit ones; fixture-safe (starts with 0000). */
const ORDER_NUMBER = `0000${"0".repeat(11)}1`;

test.describe("extractFromPastedText (roadmap Review Focus 1)", () => {
  test("a notification with one number gives the number and the carrier it names", () => {
    const text = [
      "[CJ대한통운] 고객님의 상품이 발송되었습니다.",
      `운송장번호 ${WAYBILL_HYPHENS}`,
      `배송 문의 ${FAKE.phone} · 발송일 2026.09.26 14:05`
    ].join("\n");
    expect(extractFromPastedText(text)).toEqual({ number: FAKE.domestic, carrier: "CJ" });
  });

  test("an order number next to the waybill means two candidates and no pick", () => {
    const text = `주문번호 ${ORDER_NUMBER}\n[CJ대한통운] 운송장번호 ${WAYBILL_HYPHENS}\n문의 ${FAKE.phone}`;
    expect(extractFromPastedText(text)).toBeNull();
  });

  test("grouped digits and a spaced HBL are read as one number each", () => {
    expect(extractFromPastedText(`한진택배 송장 ${FAKE_GROUPED.hbl} 입니다`)).toEqual({ number: FAKE.hbl, carrier: "HANJIN" });
    expect(extractFromPastedText(`운송장 ${FAKE_GROUPED.domestic}`)).toEqual({ number: FAKE.domestic, carrier: null });
    expect(extractFromPastedText(`CJ ${FAKE_GROUPED.domestic}`)).toEqual({ number: FAKE.domestic, carrier: null });
  });

  test("a mobile number, dates and times are never tracking numbers", () => {
    expect(extractFromPastedText(`연락처 ${FAKE.phone} 2026-09-26 14:05 2026.09.26`)).toBeNull();
    expect(extractFromPastedText(`연락처 ${FAKE.phone.replaceAll("-", " ")}`)).toBeNull();
    expect(extractFromPastedText(`연락처 ${FAKE.phone.replaceAll("-", "")}`)).toBeNull();
  });

  test("the same number twice counts once; two carriers named means no carrier", () => {
    expect(extractFromPastedText(`${FAKE.domestic} (${FAKE_GROUPED.domestic})`)).toEqual({ number: FAKE.domestic, carrier: null });
    expect(extractFromPastedText(`CJ대한통운 또는 한진택배 ${WAYBILL_HYPHENS}`)).toEqual({ number: FAKE.domestic, carrier: null });
  });

  test("full-width digits and a lowercase HBL are normalized", () => {
    expect(extractFromPastedText(`우체국택배 ${toFullWidth(WAYBILL_HYPHENS)}`)).toEqual({ number: FAKE.domestic, carrier: "EPOST" });
    expect(extractFromPastedText(`로젠택배 hbl ${FAKE.hbl.toLowerCase()}`)).toEqual({ number: FAKE.hbl, carrier: "LOGEN" });
  });

  test("text without a number gives null", () => {
    expect(extractFromPastedText("")).toBeNull();
    expect(extractFromPastedText("배송 안내입니다. 롯데택배로 보냈어요.")).toBeNull();
  });
});

test.describe("pasteCarrierNotice", () => {
  test("uses 으로 after a final consonant and 로 otherwise", () => {
    expect(pasteCarrierNotice("CJ대한통운")).toBe("택배사를 CJ대한통운으로 맞췄어요");
    for (const name of ["우체국택배", "한진택배", "롯데택배", "로젠택배"]) {
      expect(pasteCarrierNotice(name), name).toBe(`택배사를 ${name}로 맞췄어요`);
    }
  });
});
