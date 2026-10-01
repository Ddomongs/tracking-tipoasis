import { expect, test } from "@playwright/test";
import { createProxyHandler } from "@/insforge/functions/unipass-proxy";
import { FAKE } from "../fixtures/tracking-fixtures";

interface DenoLike {
  readonly env: { readonly get: (key: string) => string | undefined };
}

const SECRET = "test-proxy-secret";
const FOUND_XML =
  "<cargCsclPrgsInfoQryRtnVo><cargCsclPrgsInfoQryVo><csclPrgsStts>수입신고수리</csclPrgsStts></cargCsclPrgsInfoQryVo></cargCsclPrgsInfoQryRtnVo>";

const setDenoEnv = (values: Readonly<Record<string, string>>): void => {
  const deno: DenoLike = { env: { get: (key) => values[key] } };
  Object.assign(globalThis, { Deno: deno });
};

const withUnipass = async (run: (urls: string[]) => Promise<void>): Promise<void> => {
  const urls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input): Promise<Response> => {
    urls.push(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    return new Response(FOUND_XML, { status: 200 });
  };
  try {
    await run(urls);
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, "Deno");
  }
};

const proxyRequest = (body: unknown, headers: Record<string, string> = {}, method = "POST"): Request =>
  new Request("https://proxy.test/functions/unipass-proxy", {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: method === "POST" ? JSON.stringify(body) : undefined
  });

const fixedHandler = () => createProxyHandler({ now: () => 0, maxCallsPerMinute: 60 });

test.describe("hardened InsForge proxy (approval 12 fallback)", () => {
  test("a call without the right shared secret is refused before UNI-PASS", async () => {
    await withUnipass(async (urls) => {
      setDenoEnv({ UNIPASS_API_KEY: "stub", UNIPASS_PROXY_SECRET: SECRET });
      const handler = fixedHandler();
      expect((await handler(proxyRequest({ trackingNumber: FAKE.hbl, type: "HBL" }))).status).toBe(403);
      expect(
        (await handler(proxyRequest({ trackingNumber: FAKE.hbl, type: "HBL" }, { "x-proxy-secret": "wrong" }))).status
      ).toBe(403);
      expect(urls).toHaveLength(0);
    });
  });

  test("answers carry no CORS headers and preflight is refused", async () => {
    await withUnipass(async () => {
      setDenoEnv({ UNIPASS_API_KEY: "stub", UNIPASS_PROXY_SECRET: SECRET });
      const handler = fixedHandler();
      const ok = await handler(proxyRequest({ trackingNumber: FAKE.hbl, type: "HBL" }, { "x-proxy-secret": SECRET }));
      expect(ok.status).toBe(200);
      expect(ok.headers.get("access-control-allow-origin")).toBeNull();
      const preflight = await handler(proxyRequest(null, {}, "OPTIONS"));
      expect(preflight.status).toBe(405);
      expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
    });
  });

  test("the number format is validated per type", async () => {
    await withUnipass(async (urls) => {
      setDenoEnv({ UNIPASS_API_KEY: "stub", UNIPASS_PROXY_SECRET: SECRET });
      const handler = fixedHandler();
      const invalid: readonly unknown[] = [
        { trackingNumber: "../../etc", type: "HBL" },
        { trackingNumber: FAKE.hbl, type: "DOMESTIC" },
        { trackingNumber: FAKE.invalidShort, type: "DOMESTIC" },
        { trackingNumber: FAKE.domestic, type: "UNKNOWN" },
        { type: "HBL" }
      ];
      for (const body of invalid) {
        expect((await handler(proxyRequest(body, { "x-proxy-secret": SECRET }))).status).toBe(400);
      }
      expect(urls).toHaveLength(0);
    });
  });

  test("calls are limited per minute", async () => {
    await withUnipass(async () => {
      setDenoEnv({ UNIPASS_API_KEY: "stub", UNIPASS_PROXY_SECRET: SECRET });
      let now = 1_000;
      const handler = createProxyHandler({ now: () => now, maxCallsPerMinute: 2 });
      const call = () => handler(proxyRequest({ trackingNumber: FAKE.hbl, type: "HBL" }, { "x-proxy-secret": SECRET }));
      expect((await call()).status).toBe(200);
      expect((await call()).status).toBe(200);
      expect((await call()).status).toBe(429);
      now += 60_000;
      expect((await call()).status).toBe(200);
    });
  });

  test("the proxy is closed while the secret is not configured", async () => {
    await withUnipass(async (urls) => {
      setDenoEnv({ UNIPASS_API_KEY: "stub" });
      const response = await fixedHandler()(
        proxyRequest({ trackingNumber: FAKE.hbl, type: "HBL" }, { "x-proxy-secret": SECRET })
      );
      expect(response.status).toBe(503);
      expect(urls).toHaveLength(0);
    });
  });

  test("a valid call returns the first UNI-PASS answer with rows", async () => {
    await withUnipass(async (urls) => {
      setDenoEnv({ UNIPASS_API_KEY: "stub", UNIPASS_PROXY_SECRET: SECRET });
      const response = await fixedHandler()(
        proxyRequest({ trackingNumber: FAKE.hbl, type: "HBL" }, { "x-proxy-secret": SECRET })
      );
      const payload: unknown = await response.json();
      expect(payload).toEqual({ xml: FOUND_XML });
      expect(urls[0]).toContain("hblNo=");
      expect(urls[0]).toContain("blYy=");
    });
  });
});
