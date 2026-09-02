import { expect, test } from "@playwright/test";
import { buildTrackCacheKey } from "@/lib/cache";
import { getDeliveryCarrier } from "@/lib/delivery-carriers";
import { TrackRequestSchema } from "@/lib/schemas";
import { parseCarrierTrackingHtml } from "@/lib/services/carrier-html";
import { fetchDeliveryTracking } from "@/lib/services/delivery";

const emptyCarrierHtml = "<html><body><p>조회 결과가 없습니다.</p></body></html>";

const cjResponse = (status = "간선상차"): string =>
  JSON.stringify({
    resultCode: 200,
    data: {
      svcOutList: [
        {
          crgStDnm: status,
          branNm: "곤지암Hub",
          workDt: "2026.07.13",
          workHms: "09:30:00"
        }
      ]
    }
  });

const hanjinResponse = (status = "배송출발"): string => `
  <table><thead><tr><th>날짜</th><th>시간</th><th>상품위치</th><th>배송 진행상황</th></tr></thead>
  <tbody><tr><td>2026-07-13</td><td>10:10</td><td>서울터미널</td><td>${status}</td></tr></tbody></table>`;

const withMockedFetch = async (
  responder: (url: string) => Response,
  callback: () => Promise<void>
): Promise<void> => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input): Promise<Response> =>
    responder(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test("tracking requests default to automatic carrier lookup", () => {
  expect(TrackRequestSchema.parse({ trackingNumber: "509493884901" })).toEqual({
    trackingNumber: "509493884901",
    carrierCode: "AUTO"
  });
});

test("cache keys keep carrier selections isolated", () => {
  expect(buildTrackCacheKey("DOMESTIC", "123456789012", "CJ")).not.toBe(
    buildTrackCacheKey("DOMESTIC", "123456789012", "HANJIN")
  );
});

test("representative carriers expose secure official tracking links", () => {
  for (const code of ["CJ", "EPOST", "HANJIN", "LOTTE", "LOGEN"] as const) {
    expect(getDeliveryCarrier(code).trackingUrl("123456789012")).toMatch(/^https:\/\//);
  }
});

test("parses epost tracking rows into normalized events", () => {
  const html = `
    <table id="processTable">
      <thead><tr><th>날짜</th><th>시간</th><th>발생국</th><th>처리현황</th></tr></thead>
      <tbody><tr><td>2026.07.12</td><td>15:20</td><td>서울강남우체국</td><td>배달완료</td></tr></tbody>
    </table>`;

  expect(parseCarrierTrackingHtml("EPOST", html)).toEqual([
    {
      status: "배달완료",
      statusCode: 7,
      datetime: "2026-07-12T15:20:00+09:00",
      location: "서울강남우체국"
    }
  ]);
});

test("parses hanjin and lotte result tables by their headings", () => {
  const hanjinHtml = `
    <table><thead><tr><th>날짜</th><th>시간</th><th>상품위치</th><th>배송 진행상황</th></tr></thead>
    <tbody><tr><td>2026-07-11</td><td>08:05</td><td>대전Hub</td><td>간선상차</td></tr></tbody></table>`;
  const lotteHtml = `
    <table><thead><tr><th>단계</th><th>시간</th><th>현재위치</th><th>처리현황</th></tr></thead>
    <tbody><tr><td>3</td><td>2026/07/10 11:30</td><td>부산서부</td><td>상품인수</td></tr></tbody></table>`;

  expect(parseCarrierTrackingHtml("HANJIN", hanjinHtml)[0]).toMatchObject({
    status: "간선상차",
    statusCode: 6,
    location: "대전Hub"
  });
  expect(parseCarrierTrackingHtml("LOTTE", lotteHtml)[0]).toMatchObject({
    status: "상품인수",
    statusCode: 5,
    location: "부산서부",
    datetime: "2026-07-10T11:30:00+09:00"
  });
});

test("parses logen tables without depending on a fixed class name", () => {
  const html = `
    <table><thead><tr><th>처리일자</th><th>처리시간</th><th>처리점소</th><th>배송상태</th></tr></thead>
    <tbody><tr><td>2026.07.09</td><td>18:44</td><td>성남센터</td><td>배송완료</td></tr></tbody></table>`;

  expect(parseCarrierTrackingHtml("LOGEN", html)[0]).toMatchObject({
    status: "배송완료",
    statusCode: 7,
    location: "성남센터",
    datetime: "2026-07-09T18:44:00+09:00"
  });
});

test("maps carrier pickup wording to the domestic handoff stage", () => {
  const html = `
    <table><thead><tr><th>날짜</th><th>시간</th><th>상품위치</th><th>배송 진행상황</th></tr></thead>
    <tbody><tr><td>2026-07-13</td><td>07:10</td><td>용산영업소</td><td>집하완료</td></tr></tbody></table>`;

  expect(parseCarrierTrackingHtml("HANJIN", html)[0]).toMatchObject({
    status: "집하완료",
    statusCode: 5
  });
});

test("automatic lookup selects the only carrier with matching events", async () => {
  await withMockedFetch(
    (url) =>
      url.includes("cjlogistics.com")
        ? new Response(cjResponse(), { status: 200 })
        : new Response(emptyCarrierHtml, { status: 200 }),
    async () => {
      const result = await fetchDeliveryTracking("509493884901", "AUTO");

      expect(result).toMatchObject({ carrier: "CJ대한통운", carrierCode: "CJ" });
      expect(result.events).toHaveLength(1);
      expect(result.ambiguous).toBeUndefined();
    }
  );
});

test("automatic lookup asks for a carrier when multiple carriers match", async () => {
  await withMockedFetch(
    (url) => {
      if (url.includes("cjlogistics.com")) return new Response(cjResponse(), { status: 200 });
      if (url.includes("hanjin.com")) return new Response(hanjinResponse(), { status: 200 });
      return new Response(emptyCarrierHtml, { status: 200 });
    },
    async () => {
      const result = await fetchDeliveryTracking("509493884902", "AUTO");

      expect(result).toMatchObject({ carrierCode: "AUTO", ambiguous: true, events: [] });
    }
  );
});

test("automatic lookup reports a temporary delay when one candidate is unavailable", async () => {
  await withMockedFetch(
    (url) =>
      url.includes("cjlogistics.com")
        ? new Response("temporary outage", { status: 503 })
        : new Response(emptyCarrierHtml, { status: 200 }),
    async () => {
      const result = await fetchDeliveryTracking("509493884903", "AUTO");

      expect(result).toMatchObject({ carrierCode: "AUTO", lookupUnavailable: true, events: [] });
    }
  );
});

test("automatic lookup does not guess from a partial provider result", async () => {
  await withMockedFetch(
    (url) => {
      if (url.includes("cjlogistics.com")) return new Response(cjResponse(), { status: 200 });
      if (url.includes("hanjin.com")) return new Response("access denied", { status: 403 });
      return new Response(emptyCarrierHtml, { status: 200 });
    },
    async () => {
      const result = await fetchDeliveryTracking("509493884905", "AUTO");

      expect(result).toMatchObject({ carrierCode: "AUTO", lookupUnavailable: true, events: [] });
    }
  );
});

test("automatic lookup keeps a normal pending state when every candidate has no record", async () => {
  await withMockedFetch(
    () => new Response(emptyCarrierHtml, { status: 200 }),
    async () => {
      const result = await fetchDeliveryTracking("509493884904", "AUTO");

      expect(result).toMatchObject({ carrierCode: "AUTO", events: [] });
      expect(result.lookupUnavailable).toBeUndefined();
      expect(result.ambiguous).toBeUndefined();
    }
  );
});

test("official redirects are unavailable rather than a normal no-record response", async () => {
  await withMockedFetch(
    () => new Response(null, { status: 302, headers: { location: "https://example.com/login" } }),
    async () => {
      await expect(fetchDeliveryTracking("459384817827", "HANJIN")).rejects.toThrow(
        "한진택배 delivery tracking service unavailable"
      );
    }
  );
});

test("valid tracking rows win over dormant maintenance copy elsewhere in the page", async () => {
  await withMockedFetch(
    () =>
      new Response(`<aside hidden>시스템 점검중</aside>${hanjinResponse("배송출발")}`, {
        status: 200
      }),
    async () => {
      const result = await fetchDeliveryTracking("459384817828", "HANJIN");

      expect(result).toMatchObject({ carrierCode: "HANJIN" });
      expect(result.events[0]).toMatchObject({ status: "배송출발", statusCode: 6 });
    }
  );
});
