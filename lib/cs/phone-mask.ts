// Internal-only (contract §11.1 rule 4). The CS desk shows customer phone numbers masked (spec §10 '010-****-1234');
// the full value only leaves the page through an explicit copy action.

/** Below this many digits a number cannot be told apart safely, so every digit is hidden. */
const MIN_MASKABLE_DIGITS = 8;
const TAIL_DIGITS = 4;
const KOREA_COUNTRY_CODE = "82";
const SEOUL_PREFIX = "02";

/** Digits only; '+82 10 …' becomes '010 …'. */
function domesticDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  const international = value.trim().startsWith("+") && digits.startsWith(KOREA_COUNTRY_CODE);
  return international ? `0${digits.slice(KOREA_COUNTRY_CODE.length)}` : digits;
}

/** Keeps the prefix (02 for Seoul, otherwise 3 digits) and the last 4 digits; every digit between becomes '*'. */
export function maskPhone(phone: string): string {
  const digits = domesticDigits(phone);
  if (digits.length < MIN_MASKABLE_DIGITS) return "*".repeat(digits.length);
  const headLength = digits.startsWith(SEOUL_PREFIX) ? SEOUL_PREFIX.length : 3;
  const hidden = "*".repeat(digits.length - headLength - TAIL_DIGITS);
  return `${digits.slice(0, headLength)}-${hidden}-${digits.slice(-TAIL_DIGITS)}`;
}
