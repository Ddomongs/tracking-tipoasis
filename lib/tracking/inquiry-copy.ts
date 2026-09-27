import { identifyTrackingNumber } from "@/lib/services/identifier";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import { formatKstShortDateTime } from "@/lib/tracking/time";
import type { NumberView } from "@/lib/tracking/types";

// Protocol strings shared with the CS desk (S09 parses them), so they live here and not in the operator config.
const PREFIX = "[배송 문의]";
const NUMBER_LABEL = "조회번호";
const STAGE_LABEL = "마지막 단계";
const LAST_EVENT_LABEL = "마지막 처리";
const SCREEN_ERROR = "조회 화면 오류";
const SEPARATOR = " / ";

const FULL_WIDTH_ALNUM = /[０-９Ａ-Ｚａ-ｚ]/g;
const FULL_WIDTH_OFFSET = 0xfee0;
/** The text after '조회번호' up to the next ' /' or line break. */
const LABEL_SEGMENT = /조회번호[\s:：]*([^/\n\r]*)/;
/** Letters and digits, single spaces or hyphens between them, nothing else. */
const CLEAN_SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9 　-]*[A-Za-z0-9])?$/;

export function buildInquiryCopy(
  input:
    | { readonly kind: "status"; readonly number: NumberView; readonly stage: string; readonly lastEventAt: Date | null }
    | { readonly kind: "screenError"; readonly number: NumberView; readonly now: Date }
): string {
  const head = `${PREFIX} ${NUMBER_LABEL} ${input.number.grouped}`;
  if (input.kind === "screenError") {
    return [head, SCREEN_ERROR, formatKstShortDateTime(input.now)].join(SEPARATOR);
  }
  const parts = [head, `${STAGE_LABEL} ${input.stage}`];
  if (input.lastEventAt !== null) parts.push(`${LAST_EVENT_LABEL} ${formatKstShortDateTime(input.lastEventAt)}`);
  return parts.join(SEPARATOR);
}

/** The longest all-digit identifier a customer copies (a cargo number); longer runs are two numbers glued together. */
const MAX_DIGIT_IDENTIFIER_LENGTH = 19;

/**
 * One unbroken run (hyphens allowed) or exactly the 4-character grouping buildInquiryCopy writes. Anything else
 * (an appended phone number, a second waybill) would merge extra digits into the number, so it is refused.
 */
function isSingleIdentifier(segment: string, number: string): boolean {
  const spaced = segment.replace(/[ 　]+/g, " ").toUpperCase();
  if (!spaced.includes(" ")) return true;
  return spaced === groupTrackingNumber(number);
}

/** The number after '조회번호' when that segment is a clean identifier; otherwise null (never a guess). */
export function parseInquiryCopy(text: string): { readonly number: string } | null {
  const halfWidth = text.replace(FULL_WIDTH_ALNUM, (char) => String.fromCharCode(char.charCodeAt(0) - FULL_WIDTH_OFFSET));
  const segment = LABEL_SEGMENT.exec(halfWidth)?.[1].trim() ?? "";
  if (!CLEAN_SEGMENT.test(segment)) return null;
  const number = segment.replace(/[ 　-]/g, "").toUpperCase();
  if (!isSingleIdentifier(segment, number)) return null;
  if (/^\d+$/.test(number) && number.length > MAX_DIGIT_IDENTIFIER_LENGTH) return null;
  return identifyTrackingNumber(number).type === "UNKNOWN" ? null : { number };
}
