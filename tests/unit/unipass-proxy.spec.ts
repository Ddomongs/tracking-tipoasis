import { expect, test } from "@playwright/test";
import { createProxyHandler } from "@/insforge/functions/unipass-proxy";
import { FAKE } from "../fixtures/tracking-fixtures";
import { readFileSync } from "node:fs";
import path from "node:path";
import { POST } from "@/app/api/track/route";

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

const SERVER_ENV_KEYS = ["UNIPASS_API_KEY", "UNIPASS_API_URL", "UNIPASS_PROXY_URL", "UNIPASS_PROXY_SECRET"] as const;

const withServerProxy = async (
  secret: string | null,
  run: (proxySecrets: (string | null)[]) => Promise<void>
): Promise<void> => {
  const saved = SERVER_ENV_KEYS.map((key) => [key, process.env[key]] as const);
  const proxySecrets: (string | null)[] = [];
  const originalFetch = globalThis.fetch;
  process.env.UNIPASS_API_KEY = "stub-key-not-real";
  process.env.UNIPASS_API_URL = "https://unipass.stub/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo";
  process.env.UNIPASS_PROXY_URL = "https://proxy.stub/functions/unipass-proxy";
  if (secret === null) Reflect.deleteProperty(process.env, "UNIPASS_PROXY_SECRET");
  else process.env.UNIPASS_PROXY_SECRET = secret;
  globalThis.fetch = async (input, init): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.host === "proxy.stub") {
      proxySecrets.push(new Headers(init?.headers).get("x-proxy-secret"));
      return new Response("No backend services available for app", { status: 503 });
    }
    if (url.host === "unipass.stub") return new Response("Internal Server Error", { status: 500 });
    return new Response("not found", { status: 404 });
  };
  try {
    await run(proxySecrets);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of saved) {
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = value;
    }
  }
};

const postHbl = (number: string, ip: string): Promise<Response> =>
  POST(
    new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ trackingNumber: number, carrierCode: "AUTO" })
    })
  );

test.describe("server side of the hardened proxy", () => {
  test("the server sends the shared secret header to the proxy", async () => {
    await withServerProxy(SECRET, async (proxySecrets) => {
      await postHbl(FAKE.hbl, "198.51.100.41");
      expect(proxySecrets.length).toBeGreaterThanOrEqual(1);
      expect(proxySecrets.every((value) => value === SECRET)).toBe(true);
    });
  });

  test("the server never calls the proxy without the shared secret", async () => {
    await withServerProxy(null, async (proxySecrets) => {
      await postHbl(FAKE.hblAlt, "198.51.100.42");
      expect(proxySecrets).toHaveLength(0);
    });
  });

  test("public docs do not publish the proxy URL", () => {
    for (const file of ["DEPLOYMENT.md", "README.md", "AGENTS.md", "docs/insforge-deployment-runbook.md"]) {
      expect(readFileSync(path.join(process.cwd(), file), "utf8"), file).not.toMatch(/insforge\.app/i);
    }
  });
});
