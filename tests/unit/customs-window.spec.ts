import { expect, test } from "@playwright/test";
import { createLookupDeadline } from "@/lib/services/lookup-budget";
import { batchSampleSerials, lookupCustomsEvents, normalizeCustomsStatus, summaryProgress } from "@/lib/services/customs";
import { normalizeTrackingData } from "@/lib/services/normalizer";
import type { CustomsCargoInfo } from "@/lib/types";
import { FAKE } from "../fixtures/tracking-fixtures";

// 11월 27일 요청: clearance accuracy. The window counts from the official 입항일, and the same-batch sample moves its early end.

const emptyDelivery = { carrier: "국내택배 자동 조회", carrierCode: "AUTO" as const, events: [] };
const accepted = { status: "통관목록접수", statusCode: 2 as const, datetime: "2026-11-24T17:22:47+09:00" };
// Wed 25 November 2026, sea cargo (a real shape: list accepted the day before the ship came in).
const seaCargo: CustomsCargoInfo = { arrivalDate: "2026-11-25", bySea: true };

const normalize = (cargo: CustomsCargoInfo | undefined, now: string) =>
  normalizeTrackingData({
    trackingNumber: FAKE.domestic,
    type: "DOMESTIC",
    customsEvents: [accepted],
    deliveryLookup: emptyDelivery,
    now: new Date(now),
    cargo
  });

test.describe("clearance window from the arrival day", () => {
  test("sea cargo: 빠르면 two and 늦으면 three customs working days after arrival, skipping the weekend", () => {
    const data = normalize(seaCargo, "2026-11-26T10:00:00+09:00");
    expect(data.estimatedCustomsClearanceDate).toBe("2026-11-27T00:00:00+09:00"); // Fri
    expect(data.estimatedCustomsClearanceLatest).toBe("2026-11-30T00:00:00+09:00"); // Mon
    expect(data.customs.arrivalDate).toBe("2026-11-25T00:00:00+09:00");
    expect(data.customs.estimateAdjusted).toBeUndefined();
  });

  test("air cargo is a day faster", () => {
    const data = normalize({ arrivalDate: "2026-11-25", bySea: false }, "2026-11-25T10:00:00+09:00");
    expect(data.estimatedCustomsClearanceDate).toBe("2026-11-26T00:00:00+09:00");
    expect(data.estimatedCustomsClearanceLatest).toBe("2026-11-27T00:00:00+09:00");
  });

  test("a batch customs is clearing today makes today the early end", () => {
    const data = normalize({ ...seaCargo, batch: { sampled: 16, cleared: 10, clearedToday: 9 } }, "2026-11-26T10:00:00+09:00");
    expect(data.estimatedCustomsClearanceDate).toBe("2026-11-26T00:00:00+09:00");
    expect(data.estimatedCustomsClearanceLatest).toBe("2026-11-30T00:00:00+09:00");
    expect(data.customs.batch).toEqual({ sampled: 16, cleared: 10, clearedToday: 9 });
  });

  test("a batch with nothing cleared yet is not cleared today: the window narrows to the next working day", () => {
    const data = normalize({ ...seaCargo, batch: { sampled: 16, cleared: 0, clearedToday: 0 } }, "2026-11-27T10:00:00+09:00");
    expect(data.estimatedCustomsClearanceDate).toBe("2026-11-30T00:00:00+09:00");
    expect(data.estimatedCustomsClearanceLatest).toBeUndefined();
  });

  test("past both ends: today, marked adjusted, with no late end", () => {
    const data = normalize(seaCargo, "2026-12-02T10:00:00+09:00");
    expect(data.estimatedCustomsClearanceDate).toBe("2026-12-02T00:00:00+09:00");
    expect(data.estimatedCustomsClearanceLatest).toBeUndefined();
    expect(data.customs.estimateAdjusted).toBe(true);
  });

  test("the summary's item name is the product name", () => {
    expect(normalize({ ...seaCargo, productName: "PLASTIC  TOYS SET" }, "2026-11-26T10:00:00+09:00").productName).toBe("PLASTIC TOYS SET");
  });
});

test.describe("batch sampling", () => {
  test("통관목록심사완료 is clearance, not review", () => {
    expect(normalizeCustomsStatus("통관목록심사완료")).toBe(4);
    expect(normalizeCustomsStatus("통관목록접수")).toBe(2);
  });

  test("serials spread over 1..2×own without the own serial", () => {
    const serials = batchSampleSerials(3816);
    expect(serials.length).toBeGreaterThanOrEqual(15);
    expect(serials).not.toContain(3816);
    expect(Math.min(...serials)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...serials)).toBeLessThanOrEqual(7632);
    expect(batchSampleSerials(1).every((serial) => serial >= 1 && serial !== 1)).toBe(true);
  });

  test("a sampled summary is cleared by 목록 심사완료, 수리 or 반출, and today by its processing day", () => {
    expect(summaryProgress({ csclPrgsStts: "통관목록심사완료", prgsStts: "반출완료", prcsDttm: "2026-11-27 10:28:53" }, "2026-11-27")).toEqual({ cleared: true, today: true });
    expect(summaryProgress({ csclPrgsStts: "수입신고수리", prcsDttm: "2026-11-26 10:00:00" }, "2026-11-27")).toEqual({ cleared: true, today: false });
    expect(summaryProgress({ csclPrgsStts: "통관목록접수", prgsStts: "입항적재화물목록 운항정보 정정", prcsDttm: "2026-11-25 20:08:36" }, "2026-11-27")).toEqual({ cleared: false, today: false });
  });
});

test("UNI-PASS: the summary row is cargo facts, not an event, when detail rows exist", async () => {
  const cargMtNo = ["26ABCD", "0001I", "0000", "0012"].join("");
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?><cargCsclPrgsInfoQryRtnVo><tCnt>2</tCnt>' +
    `<cargCsclPrgsInfoQryVo><csclPrgsStts>통관목록접수</csclPrgsStts><prcsDttm>2026-11-25 20:08:36</prcsDttm><prnm>PLASTIC TOYS SET</prnm><etprDt>${["2026", "1125"].join("")}</etprDt><dsprNm>인천항</dsprNm><cargMtNo>${cargMtNo}</cargMtNo></cargCsclPrgsInfoQryVo>` +
    "<cargCsclPrgsInfoDtlQryVo><cargTrcnRelaBsopTpcd>통관목록접수</cargTrcnRelaBsopTpcd><prcsDttm>2026-11-24 17:22:47</prcsDttm><shedNm>보세창고</shedNm></cargCsclPrgsInfoDtlQryVo>" +
    "<cargCsclPrgsInfoDtlQryVo><cargTrcnRelaBsopTpcd>입항보고 수리</cargTrcnRelaBsopTpcd><prcsDttm>2026-11-25 20:08:36</prcsDttm></cargCsclPrgsInfoDtlQryVo>" +
    "</cargCsclPrgsInfoQryRtnVo>";
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.UNIPASS_API_KEY;
  process.env.UNIPASS_API_KEY = "stub-key";
  globalThis.fetch = async () => new Response(xml, { status: 200 });
  const deadline = createLookupDeadline();
  try {
    const result = await lookupCustomsEvents(FAKE.domestic, "HBL", { deadline });
    expect(result.kind).toBe("found");
    if (result.kind !== "found") return;
    expect(result.events.map((event) => event.status)).toEqual(["통관목록접수", "입항보고 수리"]);
    expect(result.events.some((event) => event.location === "PLASTIC TOYS SET")).toBe(false);
    expect(result.cargo).toEqual({ cargMtNo, arrivalDate: "2026-11-25", bySea: true, productName: "PLASTIC TOYS SET" });
  } finally {
    deadline.cancel();
    globalThis.fetch = originalFetch;
    process.env.UNIPASS_API_KEY = originalKey;
  }
});
