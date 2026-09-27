const LETTER_PREFIX = /^[A-Z]+/;
const GROUP_SIZE = 4;

/** 'TEST00000001' → 'TEST 0000 0001'; '00001234567890' → '0000 1234 5678 90'. Never truncates. */
export function groupTrackingNumber(raw: string): string {
  const value = raw.trim().toUpperCase();
  const prefix = LETTER_PREFIX.exec(value)?.[0] ?? "";
  const rest = value.slice(prefix.length);
  const groups: string[] = prefix.length > 0 ? [prefix] : [];
  for (let index = 0; index < rest.length; index += GROUP_SIZE) {
    groups.push(rest.slice(index, index + GROUP_SIZE));
  }
  return groups.join(" ");
}
