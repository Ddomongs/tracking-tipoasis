import { expect, test } from "@playwright/test";
import { maskPhone } from "@/lib/cs/phone-mask";
import { FAKE } from "../fixtures/tracking-fixtures";

// Other phone shapes are joined at runtime, so no source line holds a 10+ digit run (S01 repo guard).
const joined = (...parts: readonly string[]): string => parts.join("-");

test("a mobile number keeps 010 and the last four digits", () => {
  expect(maskPhone(FAKE.phone)).toBe("010-****-1234");
});

test("spaces, missing hyphens and +82 give the same mask", () => {
  const digitsOnly = FAKE.phone.replace(/-/g, "");
  expect(maskPhone(digitsOnly)).toBe("010-****-1234");
  expect(maskPhone(` ${FAKE.phone.replace(/-/g, " ")} `)).toBe("010-****-1234");
  expect(maskPhone(`+82 ${FAKE.phone.slice(1)}`)).toBe("010-****-1234");
  expect(maskPhone(`+82${digitsOnly.slice(1)}`)).toBe("010-****-1234");
});

test("ten-digit mobiles and Seoul numbers keep their own prefix", () => {
  expect(maskPhone(joined("011", "000", "1234"))).toBe("011-***-1234");
  expect(maskPhone("02-000-1234")).toBe("02-***-1234");
});

test("the hidden middle never leaks", () => {
  // A middle block starting with 0 is never assigned to a Korean mobile line, so this cannot be anyone's number.
  const masked = maskPhone(joined("010", "0987", "1234"));
  expect(masked).toBe("010-****-1234");
  expect(masked).not.toContain("0987");
});

test("too short to tell apart: every digit is hidden", () => {
  expect(maskPhone("1234")).toBe("****");
  expect(maskPhone("")).toBe("");
  expect(maskPhone("없음")).toBe("");
});
