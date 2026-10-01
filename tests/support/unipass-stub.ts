import { test } from "@playwright/test";
import type { z } from "zod";
import { POST } from "@/app/api/track/route";
import { ApiTrackResponseSchema } from "@/lib/schemas";
import type { DeliveryCarrierCode } from "@/lib/types";

/**
 * Port of the Phase 1 GAP2 stub-net.cjs. Every upstream the /api/track route can reach (UNI-PASS, the InsForge
 * proxy, customstrack, the five carriers) is simulated in-process with injected latency; any other host throws, so
 * nothing leaves the test process. Scenarios are keyed by fixture numbers only (see stubNumber).
 */

export const STUB_UNIPASS_URL = "https://unipass.stub/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo";
export const STUB_PROXY_URL = "https://proxy.stub/functions/unipass-proxy";
export const STUB_YEAR = new Date().getFullYear();

export type UnipassMode = "ok" | "timeout" | "http500" | "refused" | "bodyStall";
export type UnipassParam = "hblNo" | "mblNo" | "cargMtNo";
export type StubNumberKind = "HBL" | "DOMESTIC" | "CARGO";

export interface UpstreamScenario {
  readonly number: string;
  readonly unipass: { readonly mode: UnipassMode; readonly latencyMs: number; readonly failYearOffsets?: readonly number[] };
  readonly found?: { readonly param: UnipassParam; readonly yearOffset: number };
  readonly customstrack?: { readonly mode: "empty" | "timeout"; readonly latencyMs: number };
  readonly carriers?: { readonly mode: "ok" | "timeout" | "unavailable"; readonly latencyMs: number; readonly cjFound: boolean };
  readonly proxy?: { readonly mode: "unavailable503" | "timeout"; readonly latencyMs: number };
}

export interface UpstreamCalls {
  readonly unipass: number;
  readonly unipassAborted: number;
  readonly unipassYears: readonly number[];
  readonly proxy: number;
  readonly customstrack: number;
  readonly carriers: number;
}

export interface StubOptions {
  /** Default true: UNIPASS_API_KEY is set to a stub value. */
  readonly apiKey?: boolean;
  /** Default false: UNIPASS_PROXY_URL is unset. */
  readonly proxy?: boolean;
}

export interface UpstreamStub {
  readonly calls: (number: string) => UpstreamCalls;
  readonly restore: () => void;
}

// prcsDttm uses the "yyyy-MM-dd HH:mm:ss" form that parseCustomsDatetime also accepts, so this file holds no 10+ digit run.
const FOUND_XML =
  '<?xml version="1.0" encoding="UTF-8"?><cargCsclPrgsInfoQryRtnVo><tCnt>1</tCnt>' +
  "<cargCsclPrgsInfoQryVo><csclPrgsStts>수입신고수리</csclPrgsStts><prgsStts>반출완료</prgsStts><prcsDttm>2026-09-23 10:05:00</prcsDttm><etprCstmNm>인천공항세관</etprCstmNm></cargCsclPrgsInfoQryVo>" +
  "<cargCsclPrgsInfoDtlQryVo><cargTrcnRelaBsopTpcd>입항보고 수리</cargTrcnRelaBsopTpcd><prcsDttm>2026-09-22 08:40:00</prcsDttm><shedNm>인천공항</shedNm></cargCsclPrgsInfoDtlQryVo>" +
  "<cargCsclPrgsInfoDtlQryVo><cargTrcnRelaBsopTpcd>수입신고수리</cargTrcnRelaBsopTpcd><prcsDttm>2026-09-23 10:05:00</prcsDttm><shedNm>인천공항</shedNm></cargCsclPrgsInfoDtlQryVo>" +
  "</cargCsclPrgsInfoQryRtnVo>";
const EMPTY_XML =
  '<?xml version="1.0" encoding="UTF-8"?><cargCsclPrgsInfoQryRtnVo><tCnt>0</tCnt><ntceInfo>[N00] 조회결과가 없습니다.</ntceInfo></cargCsclPrgsInfoQryRtnVo>';
const CJ_FOUND = JSON.stringify({
  resultCode: "200",
  data: {
    svcOutList: [
      { crgStDnm: "집화처리", crgStDcdVal: "보내시는 고객님으로부터 상품을 인수받았습니다", branNm: "인천GW", workDt: "2026-09-24", workHms: "09:10:00" },
      { crgStDnm: "배송출발", crgStDcdVal: "고객님의 상품을 배송할 예정입니다", branNm: "서울강남", workDt: "2026-09-26", workHms: "08:15:00" }
    ]
  }
});
const CJ_EMPTY = JSON.stringify({ resultCode: "200", data: { svcOutList: [] } });
const EMPTY_HTML = "<html><body><p>조회 결과가 없습니다.</p></body></html>";

const DEFAULT_CUSTOMSTRACK = { mode: "empty", latencyMs: 1_000 } as const;
const DEFAULT_CARRIERS = { mode: "ok", latencyMs: 800, cjFound: false } as const;
const DEFAULT_PROXY = { mode: "unavailable503", latencyMs: 300 } as const;
const FOREVER_MS = 60 * 60 * 1000;
const CARRIER_HOSTS = ["service.epost.go.kr", "www.hanjin.com", "www.lotteglogis.com", "www.ilogen.com"];

interface MutableCalls {
  unipass: number;
  unipassAborted: number;
  unipassYears: number[];
  proxy: number;
  customstrack: number;
  carriers: number;
}

const abortReason = (signal?: AbortSignal | null): unknown => {
  const reason: unknown = signal?.reason;
  return reason instanceof Error ? reason : new DOMException("This operation was aborted", "AbortError");
};

const delay = (ms: number, signal?: AbortSignal | null): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortReason(signal));
      },
      { once: true }
    );
  });

const urlOf = (input: RequestInfo | URL): URL =>
  new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

const bodyText = (init?: RequestInit): string => (typeof init?.body === "string" ? init.body : "");

const carrierNumber = (url: URL): string =>
  [...url.searchParams.values()].find((value) => /^\d+$/.test(value)) ?? url.pathname.split("/").pop() ?? "";

const setEnv = (name: string, value: string | undefined): void => {
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else process.env[name] = value;
};

/** Fixture-only numbers: HBL 'TEST' + 8 digits, DOMESTIC 12 digits, CARGO 18 digits, all digit runs start with 0000. */
export function stubNumber(kind: StubNumberKind, seq: number): string {
  const digits = String(seq).padStart(4, "0");
  if (kind === "HBL") return `TEST0000${digits}`;
  if (kind === "DOMESTIC") return `00000000${digits}`;
  return `00000000000000${digits}`;
}

export function installUpstreamStub(scenarios: readonly UpstreamScenario[], options: StubOptions = {}): UpstreamStub {
  const byNumber = new Map(scenarios.map((scenario) => [scenario.number, scenario]));
  const calls = new Map<string, MutableCalls>();
  const record = (number: string): MutableCalls => {
    const existing = calls.get(number);
    if (existing) return existing;
    const created: MutableCalls = { unipass: 0, unipassAborted: 0, unipassYears: [], proxy: 0, customstrack: 0, carriers: 0 };
    calls.set(number, created);
    return created;
  };
  const scenarioFor = (number: string): UpstreamScenario => {
    const scenario = byNumber.get(number);
    if (!scenario) throw new Error("no stub scenario for this number");
    return scenario;
  };

  const unipass = async (url: URL, signal?: AbortSignal | null): Promise<Response> => {
    const param = (["hblNo", "mblNo", "cargMtNo"] as const).find((key) => url.searchParams.has(key));
    const number = param ? (url.searchParams.get(param) ?? "") : "";
    const scenario = scenarioFor(number);
    const year = Number(url.searchParams.get("blYy"));
    const counter = record(number);
    counter.unipass += 1;
    counter.unipassYears.push(year);
    const { mode, latencyMs, failYearOffsets = [] } = scenario.unipass;
    try {
      if (mode === "timeout") await delay(FOREVER_MS, signal);
      if (mode === "bodyStall") return new Response(new ReadableStream<Uint8Array>(), { status: 200 });
      await delay(latencyMs, signal);
    } catch (error) {
      counter.unipassAborted += 1;
      throw error;
    }
    if (mode === "refused") throw new TypeError("fetch failed");
    if (mode === "http500" || failYearOffsets.includes(year - STUB_YEAR)) {
      return new Response("Internal Server Error", { status: 500 });
    }
    const found =
      scenario.found !== undefined && scenario.found.param === param && year === STUB_YEAR + scenario.found.yearOffset;
    return new Response(found ? FOUND_XML : EMPTY_XML, { status: 200, headers: { "content-type": "application/xml" } });
  };

  const proxy = async (init?: RequestInit): Promise<Response> => {
    const parsed: unknown = JSON.parse(bodyText(init));
    const number =
      typeof parsed === "object" && parsed !== null && "trackingNumber" in parsed && typeof parsed.trackingNumber === "string"
        ? parsed.trackingNumber
        : "";
    const scenario = scenarioFor(number);
    record(number).proxy += 1;
    const { mode, latencyMs } = scenario.proxy ?? DEFAULT_PROXY;
    await delay(mode === "timeout" ? FOREVER_MS : latencyMs, init?.signal);
    return new Response("No backend services available for app", { status: 503 });
  };

  const customstrack = async (url: URL, signal?: AbortSignal | null): Promise<Response> => {
    const number = decodeURIComponent(url.pathname.slice(1));
    const scenario = scenarioFor(number);
    record(number).customstrack += 1;
    const { mode, latencyMs } = scenario.customstrack ?? DEFAULT_CUSTOMSTRACK;
    await delay(mode === "timeout" ? FOREVER_MS : latencyMs, signal);
    return new Response(EMPTY_HTML, { status: 200, headers: { "content-type": "text/html" } });
  };

  const carrier = async (number: string, isCj: boolean, signal?: AbortSignal | null): Promise<Response> => {
    const scenario = scenarioFor(number);
    record(number).carriers += 1;
    const { mode, latencyMs, cjFound } = scenario.carriers ?? DEFAULT_CARRIERS;
    await delay(mode === "timeout" ? FOREVER_MS : latencyMs, signal);
    if (mode === "unavailable") return new Response("service unavailable", { status: 503 });
    if (isCj) {
      return new Response(cjFound ? CJ_FOUND : CJ_EMPTY, { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(EMPTY_HTML, { status: 200, headers: { "content-type": "text/html" } });
  };

  const stubFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlOf(input);
    const signal = init?.signal;
    if (url.host === "unipass.stub") return unipass(url, signal);
    if (url.host === "proxy.stub") return proxy(init);
    if (url.host === "www.customstrack.com") return customstrack(url, signal);
    if (url.host === "trace.cjlogistics.com") {
      return carrier(new URLSearchParams(bodyText(init)).get("wblNo") ?? "", true, signal);
    }
    if (CARRIER_HOSTS.includes(url.host)) return carrier(carrierNumber(url), false, signal);
    throw new Error(`BLOCKED unexpected host ${url.host}`);
  };

  const saved = {
    key: process.env.UNIPASS_API_KEY,
    url: process.env.UNIPASS_API_URL,
    proxy: process.env.UNIPASS_PROXY_URL
  };
  const originalFetch = globalThis.fetch;
  setEnv("UNIPASS_API_KEY", options.apiKey === false ? undefined : "stub-key-not-real");
  setEnv("UNIPASS_API_URL", STUB_UNIPASS_URL);
  setEnv("UNIPASS_PROXY_URL", options.proxy === true ? STUB_PROXY_URL : undefined);
  globalThis.fetch = stubFetch;

  return {
    calls: (number) => {
      const counter = record(number);
      return { ...counter, unipassYears: [...counter.unipassYears] };
    },
    restore: () => {
      globalThis.fetch = originalFetch;
      setEnv("UNIPASS_API_KEY", saved.key);
      setEnv("UNIPASS_API_URL", saved.url);
      setEnv("UNIPASS_PROXY_URL", saved.proxy);
    }
  };
}

export async function withUpstreams(
  scenarios: readonly UpstreamScenario[],
  run: (stub: UpstreamStub) => Promise<void>,
  options: StubOptions = {}
): Promise<void> {
  const stub = installUpstreamStub(scenarios, options);
  try {
    await run(stub);
  } finally {
    stub.restore();
  }
}

export type TrackPayload = z.infer<typeof ApiTrackResponseSchema>;
type SuccessPayload = Extract<TrackPayload, { success: true }>;

export interface TrackCall {
  readonly status: number;
  readonly ms: number;
  readonly payload: TrackPayload;
}

let requestSeq = 0;

/** Calls the real route handler once, from a fresh client IP so the per-IP quota never interferes. */
export async function callTrack(number: string, carrierCode: DeliveryCarrierCode = "AUTO"): Promise<TrackCall> {
  requestSeq += 1;
  const request = new Request("http://localhost/api/track", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": `10.9.${Math.floor(requestSeq / 250)}.${requestSeq % 250}`
    },
    body: JSON.stringify({ trackingNumber: number, carrierCode })
  });
  const startedAt = Date.now();
  const response = await POST(request);
  const payload = ApiTrackResponseSchema.parse(await response.json());
  return { status: response.status, ms: Date.now() - startedAt, payload };
}

export const dataOf = (call: TrackCall): SuccessPayload["data"] | null => (call.payload.success ? call.payload.data : null);

export const errorCodeOf = (call: TrackCall): string | null => (call.payload.success ? null : call.payload.error.code);

/** Records a measured budget in the report (annotation) and on stdout for the stage summary (gate G8). */
export function recordBudget(name: string, measuredMs: number, limitMs: number): void {
  const description = `${name}: ${measuredMs} ms (limit ${limitMs} ms)`;
  test.info().annotations.push({ type: "budget", description });
  console.info(`[budget] ${description}`);
}
