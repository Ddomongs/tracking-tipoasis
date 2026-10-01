type TrackingType = "DOMESTIC" | "HBL" | "CARGO";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

/** The Vercel function sends this header; the value lives only in the Vercel and InsForge env vars (UNIPASS_PROXY_SECRET). */
const SECRET_HEADER = "x-proxy-secret";
const DEFAULT_UNIPASS_URL = "https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo";
const WINDOW_MS = 60_000;
const DEFAULT_MAX_CALLS_PER_MINUTE = 60;
const CALL_TIMEOUT_MS = 12000;

const NUMBER_PATTERNS: Readonly<Record<TrackingType, RegExp>> = {
  HBL: /^[A-Z]{3,4}\d{8,16}$/,
  DOMESTIC: /^\d{10,14}$/,
  CARGO: /^\d{15,30}$/
};

const PARAMS_BY_TYPE: Readonly<Record<TrackingType, readonly string[]>> = {
  CARGO: ["cargMtNo"],
  HBL: ["hblNo", "mblNo"],
  DOMESTIC: ["hblNo", "mblNo", "cargMtNo"]
};

const buildRequestUrls = (apiUrl: string, apiKey: string, trackingNumber: string, type: TrackingType): string[] => {
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear + 1, thisYear - 1, thisYear - 2, thisYear - 3, thisYear - 4];
  return years.flatMap((year) =>
    PARAMS_BY_TYPE[type].map(
      (param) => `${apiUrl}?${new URLSearchParams({ crkyCn: apiKey, blYy: String(year), [param]: trackingNumber }).toString()}`
    )
  );
};

/** No CORS headers: only the Vercel server calls this function. */
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

const safeEqual = (left: string, right: string): boolean => {
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
};

const isTrackingType = (value: unknown): value is TrackingType =>
  value === "HBL" || value === "DOMESTIC" || value === "CARGO";

const readLookup = async (request: Request): Promise<{ readonly trackingNumber: string; readonly type: TrackingType } | null> => {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const trackingNumber = typeof record.trackingNumber === "string" ? record.trackingNumber.trim().toUpperCase() : "";
  if (!isTrackingType(record.type) || !NUMBER_PATTERNS[record.type].test(trackingNumber)) return null;
  return { trackingNumber, type: record.type };
};

const sweepYears = async (urls: readonly string[]): Promise<string> => {
  let lastXml = "";
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 tracking.tipoasis.com" },
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS)
      });
      if (!response.ok) continue;
      const xml = await response.text();
      lastXml = xml;
      if (xml.includes("<cargCsclPrgsInfoQryVo>") || xml.includes("<cargCsclPrgsInfoDtlQryVo>")) return xml;
    } catch {
      continue;
    }
  }
  return lastXml;
};

export interface ProxyHandlerOptions {
  readonly now: () => number;
  readonly maxCallsPerMinute: number;
}

/** Per-instance call limit (best effort: each edge instance counts on its own). */
export function createProxyHandler(options: ProxyHandlerOptions): (request: Request) => Promise<Response> {
  let windowStartedAt = options.now();
  let callsInWindow = 0;
  const allowCall = (): boolean => {
    const now = options.now();
    if (now - windowStartedAt >= WINDOW_MS) {
      windowStartedAt = now;
      callsInWindow = 0;
    }
    if (callsInWindow >= options.maxCallsPerMinute) return false;
    callsInWindow += 1;
    return true;
  };

  return async (request) => {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const secret = Deno.env.get("UNIPASS_PROXY_SECRET");
    const apiKey = Deno.env.get("UNIPASS_API_KEY");
    if (!secret || !apiKey) return json({ error: "Proxy is not configured" }, 503);
    if (!safeEqual(request.headers.get(SECRET_HEADER) ?? "", secret)) return json({ error: "Forbidden" }, 403);
    const lookup = await readLookup(request);
    if (!lookup) return json({ error: "Invalid trackingNumber or type" }, 400);
    if (!allowCall()) return json({ error: "Too many requests" }, 429);
    const apiUrl = Deno.env.get("UNIPASS_API_URL") || DEFAULT_UNIPASS_URL;
    return json({ xml: await sweepYears(buildRequestUrls(apiUrl, apiKey, lookup.trackingNumber, lookup.type)) });
  };
}

export default createProxyHandler({ now: () => Date.now(), maxCallsPerMinute: DEFAULT_MAX_CALLS_PER_MINUTE });
