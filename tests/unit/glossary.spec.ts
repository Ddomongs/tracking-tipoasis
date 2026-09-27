import { expect, test } from "@playwright/test";
import type { GlossaryEntry } from "@/lib/config/types";
import { glossaryLabel } from "@/lib/tracking/glossary";

const GLOSSARY: readonly GlossaryEntry[] = [
  { source: "수입신고수리", label: "통관 완료" },
  { source: "통관목록접수", label: "통관 접수" },
  { source: "간선하차", label: "지역 터미널 도착" },
  { source: "입항", label: "입항" }
];

test("a known term gets the customer label and keeps the original", () => {
  expect(glossaryLabel("수입신고수리", GLOSSARY)).toEqual({ label: "통관 완료", original: "수입신고수리" });
  expect(glossaryLabel("간선하차", GLOSSARY)).toEqual({ label: "지역 터미널 도착", original: "간선하차" });
});

test("spacing differences still match; the original is trimmed", () => {
  expect(glossaryLabel(" 통관목록 접수 ", GLOSSARY)).toEqual({ label: "통관 접수", original: "통관목록 접수" });
});

test("an unknown term is shown as it is, without an original", () => {
  expect(glossaryLabel("배송출발", GLOSSARY)).toEqual({ label: "배송출발", original: null });
});

test("a term whose label equals the source has no original", () => {
  expect(glossaryLabel("입항", GLOSSARY)).toEqual({ label: "입항", original: null });
});

test("an empty status stays empty", () => {
  expect(glossaryLabel("   ", GLOSSARY)).toEqual({ label: "", original: null });
});
