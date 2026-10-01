import { expect, test } from "@playwright/test";
import { maxDuration, POST } from "@/app/api/track/route";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { ApiTrackResponseSchema } from "@/lib/schemas";
import { setLookupLogSink } from "@/lib/services/lookup-log";
import { FAKE } from "./fixtures/tracking-fixtures";

test("a carrier outage keeps the selected carrier and official fallback link", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (): Promise<Response> => {
    throw new TypeError("fetch failed");
  };

  try {
    const response = await POST(
      new Request("http://localhost/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackingNumber: FAKE.domestic, carrierCode: "HANJIN" })
      })
    );
    const payload = ApiTrackResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    if (!payload.success) return;
    expect(payload.data.delivery).toMatchObject({
      carrier: "한진택배",
      carrierCode: "HANJIN",
      invoiceNumber: FAKE.domestic,
      lookupUnavailable: true,
      events: []
    });
    expect(payload.data.currentStatus).toBe("조회 지연");
    expect(payload.data.isPending).toBeUndefined();
    expect(payload.data.delivery.trackingUrl).toContain("hanjin.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an official carrier HTTP outage returns a retryable neutral result", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (): Promise<Response> => new Response("service unavailable", { status: 503 });

  try {
    const response = await POST(
      new Request("http://localhost/api/track", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.21" },
        body: JSON.stringify({ trackingNumber: FAKE.domesticAlt, carrierCode: "HANJIN" })
      })
    );
    const payload = ApiTrackResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    if (!payload.success) return;
    expect(payload.data.currentStatus).toBe("조회 지연");
    expect(payload.data.delivery).toMatchObject({
      carrierCode: "HANJIN",
      lookupUnavailable: true,
      events: []
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("temporary carrier failures are not cached as tracking results", async () => {
  const originalFetch = globalThis.fetch;
  let carrierCalls = 0;
  globalThis.fetch = async (input): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("hanjin.com")) carrierCalls += 1;
    return new Response("service unavailable", { status: 503 });
  };

  const request = () =>
    POST(
      new Request("http://localhost/api/track", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.22" },
        body: JSON.stringify({ trackingNumber: FAKE.domestic14, carrierCode: "HANJIN" })
      })
    );

  try {
    expect((await request()).status).toBe(200);
    expect((await request()).status).toBe(200);
    expect(carrierCalls).toBe(2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("malformed JSON is rejected as a client request error", async () => {
  const response = await POST(
    new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.23" },
      body: "{not-json"
    })
  );

  expect(response.status).toBe(400);
});

test("non-JSON tracking requests are rejected before lookup", async () => {
  const response = await POST(
    new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "text/plain", "x-forwarded-for": "198.51.100.24" },
      body: FAKE.domestic
    })
  );

  expect(response.status).toBe(415);
});

test("oversized JSON requests are rejected before tracking lookup", async () => {
  const response = await POST(
    new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.25" },
      body: JSON.stringify({ trackingNumber: "5".repeat(2048), carrierCode: "AUTO" })
    })
  );

  expect(response.status).toBe(413);
});

test("the route declares a 30 s function ceiling", () => {
  expect(maxDuration).toBe(30);
});

test("every response writes one number-free lookup log line", async () => {
  const lines: string[] = [];
  const originalFetch = globalThis.fetch;
  const savedKey = process.env.UNIPASS_API_KEY;
  const savedProxy = process.env.UNIPASS_PROXY_URL;
  Reflect.deleteProperty(process.env, "UNIPASS_API_KEY");
  Reflect.deleteProperty(process.env, "UNIPASS_PROXY_URL");
  setLookupLogSink((line) => {
    lines.push(line);
  });
  globalThis.fetch = async (): Promise<Response> => {
    throw new TypeError("fetch failed");
  };

  try {
    await POST(
      new Request("http://localhost/api/track", {
        method: "POST",
        headers: { "content-type": "text/plain", "x-forwarded-for": "198.51.100.31" },
        body: FAKE.phone
      })
    );
    await POST(
      new Request("http://localhost/api/track", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.32" },
        body: JSON.stringify({ trackingNumber: FAKE.hblAlt, carrierCode: "AUTO" })
      })
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('"resultKind":"invalid","errorCode":"INVALID_NUMBER"');
    expect(lines[1]).toContain('"resultKind":"notFound","errorCode":"NOT_FOUND"');
    for (const line of lines) {
      expect(line.startsWith("track_lookup {")).toBe(true);
      expect(line).not.toContain(FAKE.hblAlt);
      expect(line).not.toContain("0000-1234");
      expect(containsTrackingLikeValue(line)).toBe(false);
    }
  } finally {
    globalThis.fetch = originalFetch;
    setLookupLogSink(null);
    if (savedKey !== undefined) process.env.UNIPASS_API_KEY = savedKey;
    if (savedProxy !== undefined) process.env.UNIPASS_PROXY_URL = savedProxy;
  }
});
