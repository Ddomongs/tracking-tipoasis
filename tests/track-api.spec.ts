import { expect, test } from "@playwright/test";
import { POST } from "@/app/api/track/route";
import { ApiTrackResponseSchema } from "@/lib/schemas";

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
        body: JSON.stringify({ trackingNumber: "459384817824", carrierCode: "HANJIN" })
      })
    );
    const payload = ApiTrackResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    if (!payload.success) return;
    expect(payload.data.delivery).toMatchObject({
      carrier: "한진택배",
      carrierCode: "HANJIN",
      invoiceNumber: "459384817824",
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
        body: JSON.stringify({ trackingNumber: "459384817825", carrierCode: "HANJIN" })
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
        body: JSON.stringify({ trackingNumber: "459384817826", carrierCode: "HANJIN" })
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
      body: "509493884901"
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
