/**
 * Lookup input rules (spec §3 딥링크 3분기, §4 입력). Pure: no window, no storage, no clock (contract §11.1 rule 5).
 * The server route and the client island use the same functions, so a deep link and a typed number can never disagree.
 */
import { identifyTrackingNumber } from "@/lib/services/identifier";
import { CONCRETE_CARRIER_CODES } from "@/lib/tracking/carriers";
import type { ConcreteCarrierCode, InvalidReason } from "@/lib/tracking/types";
import type { DeliveryCarrierCode } from "@/lib/types";

/** The API's limit for `trackingNumber` (lib/schemas.ts TrackRequestSchema). */
export const MAX_NUMBER_LENGTH = 30;

export type DeepLinkDecision =
  | { readonly kind: "valid"; readonly number: string }
  | { readonly kind: "invalid"; readonly input: string }
  | { readonly kind: "notFound" };

export type ConfusableKind = "letterO" | "letterIl";
export type ConfusableHint = { readonly kind: ConfusableKind; readonly suggestion: string; readonly message: string } | null;

export type PrecheckResult =
  | { readonly ok: true; readonly number: string }
  | { readonly ok: false; readonly reason: InvalidReason; readonly diagnosis: string };

const FULL_WIDTH_ASCII = /[！-～]/g;
const FULL_WIDTH_OFFSET = 0xfee0;
/** Whitespace (incl. U+3000 and NBSP), ASCII hyphen, Unicode hyphens/dashes and the minus sign. */
const SEPARATORS = /[\s\-‐-―−]/g;
const DEEP_LINK_SHAPE = /^[A-Z0-9]{6,30}$/;
const HBL_PREFIX = /^([A-Z]{3,4})(.+)$/;
const HBL_DIGITS = /^[A-Z]{3,4}(\d*)$/;
const CONFUSABLE_MESSAGES: Readonly<Record<ConfusableKind, string>> = {
  letterO: "영문 O가 섞여 있어요. 숫자 0인가요?",
  letterIl: "영문 I나 l이 섞여 있어요. 숫자 1인가요?"
};

/** Trim, remove spaces and hyphens, full-width → half-width, uppercase. */
export function normalizeInput(value: string): string {
  return value
    .replace(FULL_WIDTH_ASCII, (character) => String.fromCharCode(character.charCodeAt(0) - FULL_WIDTH_OFFSET))
    .replace(SEPARATORS, "")
    .toUpperCase();
}

/** A normalized value the API accepts: identifyTrackingNumber knows it and it fits the request limit. */
function isAcceptedNumber(normalized: string): boolean {
  return normalized.length <= MAX_NUMBER_LENGTH && identifyTrackingNumber(normalized).type !== "UNKNOWN";
}

/** `segment` is already URI-decoded by the caller. */
export function classifyDeepLink(segment: string): DeepLinkDecision {
  const normalized = normalizeInput(segment);
  if (isAcceptedNumber(normalized)) return { kind: "valid", number: normalized };
  if (DEEP_LINK_SHAPE.test(normalized)) return { kind: "invalid", input: normalized };
  return { kind: "notFound" };
}

/** `?c=` → a concrete carrier code, anything else → "AUTO". */
export function parseCarrierParam(value: string | readonly string[] | undefined): DeliveryCarrierCode {
  const raw = typeof value === "string" ? value : value?.[0];
  const code = raw?.trim().toUpperCase() ?? "";
  return CONCRETE_CARRIER_CODES.find((carrier) => carrier === code) ?? "AUTO";
}

const toDigits = (part: string): string => part.replace(/O/g, "0").replace(/[IL]/g, "1");

/** Only for values that are not valid yet and become valid when O → 0 and I/L → 1 in the digit part. */
export function detectConfusables(normalized: string): ConfusableHint {
  if (normalized === "" || isAcceptedNumber(normalized)) return null;
  const splits: Array<{ readonly prefix: string; readonly rest: string }> = [];
  const hbl = HBL_PREFIX.exec(normalized);
  if (hbl !== null) splits.push({ prefix: hbl[1] ?? "", rest: hbl[2] ?? "" });
  splits.push({ prefix: "", rest: normalized });
  for (const { prefix, rest } of splits) {
    if (!/[OIL]/.test(rest)) continue;
    const suggestion = `${prefix}${toDigits(rest)}`;
    if (!isAcceptedNumber(suggestion)) continue;
    const kind: ConfusableKind = rest.includes("O") ? "letterO" : "letterIl";
    return { kind, suggestion, message: CONFUSABLE_MESSAGES[kind] };
  }
  return null;
}

const fail = (reason: InvalidReason, diagnosis: string): PrecheckResult => ({ ok: false, reason, diagnosis });

/** Client pre-check before any request (spec §4 "형식은 … 클라이언트에서 먼저 검사"). */
export function precheckNumber(value: string): PrecheckResult {
  const normalized = normalizeInput(value);
  if (normalized === "") return fail("empty", "조회번호를 넣어 주세요");
  if (normalized.length > MAX_NUMBER_LENGTH) {
    return fail("tooLong", `지금 ${normalized.length}자예요. ${MAX_NUMBER_LENGTH}자까지 넣을 수 있어요`);
  }
  if (isAcceptedNumber(normalized)) return { ok: true, number: normalized };
  const confusable = detectConfusables(normalized);
  if (confusable !== null) return fail("confusableLetter", `입력하신 값: ${value.trim()} → ${confusable.message}`);
  if (/^\d+$/.test(normalized)) return fail("tooShort", `지금 ${normalized.length}자리예요`);
  const hblDigits = HBL_DIGITS.exec(normalized);
  if (hblDigits !== null) {
    const digits = (hblDigits[1] ?? "").length;
    return digits < 8
      ? fail("tooShort", `영문 뒤 숫자가 지금 ${digits}자리예요`)
      : fail("badFormat", `영문 뒤 숫자가 지금 ${digits}자리예요. 8~16자리여야 해요`);
  }
  if (/[^A-Z0-9]/.test(normalized)) return fail("badFormat", "숫자와 영문만 넣을 수 있어요");
  return fail("badFormat", "영문은 번호 앞에 3~4자만 올 수 있어요");
}

export interface PasteExtraction {
  readonly number: string;
  readonly carrier: ConcreteCarrierCode | null;
}

/** Letter/digit runs, optionally joined by single hyphens ('0000-1234-5678', '010-0000-1234'). */
const TOKEN = /[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g;
const DIGIT_GROUP = /^\d{1,4}$/;
const LETTER_PREFIX = /^[A-Za-z]{3,4}$/;
/** '010-0000-1234', '02-000-0000' and the like, as written in notifications. */
const PHONE_FORMAT = /^0\d{1,2}[ -]\d{3,4}[ -]\d{4}$/;
/** Korean mobile numbers after normalization (10–11 digits, 010/011/016/017/018/019). */
const MOBILE_NUMBER = /^01[016789]\d{7,8}$/;
const CARRIER_MENTIONS: ReadonlyArray<readonly [ConcreteCarrierCode, RegExp]> = [
  ["CJ", /CJ\s*대한통운|대한통운|CJ\s*택배/i],
  ["EPOST", /우체국/],
  ["HANJIN", /한진/],
  ["LOTTE", /롯데/],
  ["LOGEN", /로젠/]
];

interface Token {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/** Every token alone, plus runs of short groups written with single spaces ('0000 1234 5678', 'TEST 0000 0001'). */
function candidateStrings(text: string): string[] {
  const tokens: Token[] = Array.from(text.matchAll(TOKEN), (match) => ({
    text: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length
  }));
  const candidates = tokens.map((token) => token.text);
  let group: Token[] = [];
  const flush = (): void => {
    if (group.length >= 2 && group.some((token) => DIGIT_GROUP.test(token.text))) {
      candidates.push(group.map((token) => token.text).join(" "));
    }
    group = [];
  };
  for (const token of tokens) {
    const previous = group[group.length - 1];
    const adjacent = previous !== undefined && /^\s$/.test(text.slice(previous.end, token.start));
    if (DIGIT_GROUP.test(token.text)) {
      if (!adjacent) flush();
      group.push(token);
      continue;
    }
    flush();
    if (LETTER_PREFIX.test(token.text)) group.push(token);
  }
  flush();
  return candidates;
}

function carrierMentionedIn(text: string): ConcreteCarrierCode | null {
  const mentioned = CARRIER_MENTIONS.filter(([, pattern]) => pattern.test(text)).map(([code]) => code);
  return mentioned.length === 1 ? (mentioned[0] ?? null) : null;
}

/**
 * A pasted notification (spec §4): the one tracking number in it and the carrier it names.
 * Null unless exactly one distinct valid candidate exists — a second candidate (an order number, another waybill)
 * means the customer must choose, so nothing is picked (roadmap Review Focus 1).
 */
export function extractFromPastedText(text: string): PasteExtraction | null {
  const cleaned = text
    .replace(FULL_WIDTH_ASCII, (character) => String.fromCharCode(character.charCodeAt(0) - FULL_WIDTH_OFFSET))
    .replace(/[‐-―−]/g, "-");
  const numbers = new Set<string>();
  for (const raw of candidateStrings(cleaned)) {
    if (PHONE_FORMAT.test(raw)) continue;
    const number = normalizeInput(raw);
    if (MOBILE_NUMBER.test(number)) continue;
    if (isAcceptedNumber(number)) numbers.add(number);
  }
  if (numbers.size !== 1) return null;
  const [number] = [...numbers];
  if (number === undefined) return null;
  return { number, carrier: carrierMentionedIn(cleaned) };
}

/** '으로' after a final consonant other than ㄹ, '로' otherwise (and after non-Hangul). */
function directionalParticle(word: string): "으로" | "로" {
  const code = word.charCodeAt(word.length - 1);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return "로";
  const finalConsonant = (code - 0xac00) % 28;
  return finalConsonant === 0 || finalConsonant === 8 ? "로" : "으로";
}

/** '택배사를 CJ대한통운으로 맞췄어요' (spec §4 paste notice). */
export function pasteCarrierNotice(carrierName: string): string {
  return `택배사를 ${carrierName}${directionalParticle(carrierName)} 맞췄어요`;
}
