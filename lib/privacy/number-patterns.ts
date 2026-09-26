import { ADSENSE_PUBLISHER_DIGITS } from "@/lib/site";

/** A run of 10+ digits, optionally separated by single spaces or hyphens. Global: use matchAll, or copy it before .test(). */
export const DIGIT_RUN_PATTERN = /\d(?:[ -]?\d){9,}/g;
/** HBL-like token: 3–4 ASCII letters immediately followed by 8–16 digits, not inside a longer letter/digit run. Global. */
export const HBL_LIKE_PATTERN = /(?<![A-Za-z0-9])[A-Za-z]{3,4}\d{8,16}(?![A-Za-z0-9])/g;

const FIXTURE_PREFIX = "0000";
const FAKE_MOBILE_DIGITS = /^0100000\d{4}$/;
const ALL_ZERO_DIGITS = /^0+$/;
/** What DIGIT_RUN_PATTERN takes from '2026-09-26 14:05': a calendar date and an hour, not a number. */
const DATE_HOUR_TEXT = /^\d{4}-\d{2}-\d{2} \d{2}$/;
const PERCENT_ESCAPES = /(?:%[0-9A-Fa-f]{2})+/g;
const MAX_DECODE_ROUNDS = 5;
const MIN_TIMESTAMP_YEAR = 2000;
const MAX_TIMESTAMP_YEAR = 2099;

const digitsOnly = (run: string): string => run.replace(/[ -]/g, "");
const freshCopy = (pattern: RegExp): RegExp => new RegExp(pattern.source, pattern.flags);

/** yyyymmddhhmmss with a real calendar date. */
function isTimestamp14(digits: string): boolean {
  if (!/^\d{14}$/.test(digits)) return false;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const hour = Number(digits.slice(8, 10));
  const minute = Number(digits.slice(10, 12));
  const second = Number(digits.slice(12, 14));
  if (year < MIN_TIMESTAMP_YEAR || year > MAX_TIMESTAMP_YEAR || hour > 23 || minute > 59 || second > 59) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Repo guard allowlist (roadmap §11.4). `run` may contain the separators DIGIT_RUN_PATTERN allows. */
export function isAllowedDigitRun(run: string, extraAllowed: readonly string[] = []): boolean {
  const digits = digitsOnly(run);
  return (
    digits.startsWith(FIXTURE_PREFIX) ||
    digits === ADSENSE_PUBLISHER_DIGITS ||
    extraAllowed.includes(digits) ||
    isTimestamp14(digits) ||
    FAKE_MOBILE_DIGITS.test(digits)
  );
}

/** Raw runs (separators kept, document order) that the repository must not contain. Skips 'YYYY-MM-DD HH'. */
export function findDisallowedDigitRuns(text: string, extraAllowed: readonly string[] = []): readonly string[] {
  return Array.from(text.matchAll(freshCopy(DIGIT_RUN_PATTERN)), (match) => match[0]).filter(
    (raw) => !DATE_HOUR_TEXT.test(raw) && !isAllowedDigitRun(raw, extraAllowed)
  );
}

/** URI-decodes until stable (at most 5 rounds). Malformed escapes stay as they are; valid ones around them still decode. */
export function decodeRepeatedly(text: string): string {
  let current = text;
  for (let round = 0; round < MAX_DECODE_ROUNDS; round += 1) {
    const next = current.replace(PERCENT_ESCAPES, (sequence) => {
      try {
        return decodeURIComponent(sequence);
      } catch {
        return sequence; // a broken escape is data, not an error: keep it and continue
      }
    });
    if (next === current) return current;
    current = next;
  }
  return current;
}

function hasTrackingLikeValue(text: string): boolean {
  const runs = Array.from(text.matchAll(freshCopy(DIGIT_RUN_PATTERN)), (match) => digitsOnly(match[0]));
  if (runs.some((digits) => digits !== ADSENSE_PUBLISHER_DIGITS && !ALL_ZERO_DIGITS.test(digits))) return true;
  return freshCopy(HBL_LIKE_PATTERN).test(text);
}

/**
 * Traffic/copy check (strict): after repeated URI-decoding (and with '+' read as a space), any 10+ digit run other than the
 * AdSense publisher digits or an all-zero placeholder, or any HBL-like token. Fixtures such as '000012345678' count.
 */
export function containsTrackingLikeValue(text: string): boolean {
  const decoded = decodeRepeatedly(text);
  return hasTrackingLikeValue(decoded) || hasTrackingLikeValue(decoded.replace(/\+/g, " "));
}
