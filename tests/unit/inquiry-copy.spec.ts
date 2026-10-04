import { expect, test } from "@playwright/test";
import { buildInquiryCopy, parseInquiryCopy } from "@/lib/tracking/inquiry-copy";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import { FAKE, FAKE_GROUPED, FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const DOMESTIC = { raw: FAKE.domestic, grouped: FAKE_GROUPED.domestic };
const HBL = { raw: FAKE.hbl, grouped: FAKE_GROUPED.hbl };
const toFullWidth = (text: string): string =>
  text.replace(/[0-9A-Za-z]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0xfee0));
const hyphenated = `${FAKE.domestic.slice(0, 4)}-${FAKE.domestic.slice(4, 8)}-${FAKE.domestic.slice(8)}`;

test("status copy: number, last stage and last event time in KST", () => {
  expect(buildInquiryCopy({ kind: "status", number: DOMESTIC, stage: "통관 대기", lastEventAt: new Date("2026-09-23T14:10:00+09:00") }))
    .toBe(`[배송 문의] 조회번호 ${FAKE.domestic} / 마지막 단계 통관 대기 / 마지막 처리 9월 23일 14:10`);
});

test("status copy without any event leaves out the last-event part", () => {
  expect(buildInquiryCopy({ kind: "status", number: HBL, stage: "국내 도착 전", lastEventAt: null }))
    .toBe(`[배송 문의] 조회번호 ${FAKE.hbl} / 마지막 단계 국내 도착 전`);
});

test("screen-error copy carries the time of the error", () => {
  expect(buildInquiryCopy({ kind: "screenError", number: DOMESTIC, now: FIXTURE_NOW }))
    .toBe(`[배송 문의] 조회번호 ${FAKE.domestic} / 조회 화면 오류 / 9월 26일 14:05`);
});

test("the CS side reads the number back from both formats", () => {
  const status = buildInquiryCopy({ kind: "status", number: DOMESTIC, stage: "통관 대기", lastEventAt: null });
  const screenError = buildInquiryCopy({ kind: "screenError", number: HBL, now: FIXTURE_NOW });
  expect(parseInquiryCopy(status)).toEqual({ number: FAKE.domestic });
  expect(parseInquiryCopy(screenError)).toEqual({ number: FAKE.hbl });
});

test("chat text around the copy, line breaks, hyphens and full-width characters still parse", () => {
  const pasted = `안녕하세요\n[배송 문의] 조회번호 ${FAKE.domestic} / 마지막 단계 통관 대기\n확인 부탁드려요`;
  expect(parseInquiryCopy(pasted)).toEqual({ number: FAKE.domestic });
  expect(parseInquiryCopy(`조회번호: ${toFullWidth(FAKE_GROUPED.hbl)}`)).toEqual({ number: FAKE.hbl });
  expect(parseInquiryCopy(`조회번호\n${hyphenated}`)).toEqual({ number: FAKE.domestic });
});

test("never guesses: words after the number, a short number, no label or an empty label give null", () => {
  expect(parseInquiryCopy(`조회번호 ${FAKE.domestic} 9월 23일 도착 예정`)).toBeNull();
  expect(parseInquiryCopy(`조회번호 ${FAKE.invalidShort}`)).toBeNull();
  expect(parseInquiryCopy(`[배송 문의] ${FAKE_GROUPED.domestic}`)).toBeNull();
  expect(parseInquiryCopy("조회번호 / 마지막 단계 통관 대기")).toBeNull();
});

test("never merges extra digits: an appended phone number or a second waybill gives null", () => {
  const withPhone = `조회번호 ${FAKE.domestic} ${FAKE.phone.replace(/-/g, " ")}\n연락 부탁드려요`;
  expect(parseInquiryCopy(withPhone)).toBeNull();
  expect(parseInquiryCopy(`조회번호 ${FAKE.domestic} ${FAKE_GROUPED.domesticAlt}`)).toBeNull();
  expect(parseInquiryCopy(`조회번호 ${FAKE.domestic}  ${FAKE_GROUPED.domesticAlt}`)).toBeNull();
  // The grouped form buildInquiryCopy writes for a cargo number still parses.
  expect(parseInquiryCopy(`조회번호 ${groupTrackingNumber(FAKE.cargo)}`)).toEqual({ number: FAKE.cargo });
});

test("the first label wins", () => {
  expect(parseInquiryCopy(`조회번호 ${FAKE.domestic} / 조회번호 ${FAKE.hbl}`)).toEqual({ number: FAKE.domestic });
});
