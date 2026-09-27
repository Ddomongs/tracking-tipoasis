import { expect, test } from "@playwright/test";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import { FAKE, FAKE_GROUPED } from "../fixtures/tracking-fixtures";

test("domestic waybills group in fours from the left", () => {
  expect(groupTrackingNumber(FAKE.domestic)).toBe(FAKE_GROUPED.domestic);
  expect(groupTrackingNumber(FAKE.domesticAlt)).toBe(FAKE_GROUPED.domesticAlt);
  expect(groupTrackingNumber(FAKE.domestic14)).toBe("0000 1234 5678 90");
  expect(groupTrackingNumber(FAKE.domestic10)).toBe("0000 1234 56");
});

test("HBL letters form one group before the digit groups", () => {
  expect(groupTrackingNumber(FAKE.hbl)).toBe(FAKE_GROUPED.hbl);
  expect(groupTrackingNumber(FAKE.hblAlt)).toBe(FAKE_GROUPED.hblAlt);
  expect(groupTrackingNumber(FAKE.hbl.toLowerCase())).toBe(FAKE_GROUPED.hbl);
});

test("long cargo numbers keep every digit (no truncation)", () => {
  const grouped = groupTrackingNumber(FAKE.cargo);
  expect(grouped.replace(/ /g, "")).toBe(FAKE.cargo);
  expect(grouped.split(" ").every((group) => group.length <= 4)).toBe(true);
});

test("empty input stays empty", () => {
  expect(groupTrackingNumber("")).toBe("");
});
