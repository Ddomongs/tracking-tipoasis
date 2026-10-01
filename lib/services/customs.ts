import { parseStringPromise } from "xml2js";
import type { TrackingEvent, TrackingType } from "@/lib/types";
import { toIsoOrNow } from "@/lib/utils";
import { readTextWithLimit } from "@/lib/services/http";
import { LOOKUP_TIMING, type LookupDeadline } from "@/lib/services/lookup-budget";
import type { UnipassCallOutcome } from "@/lib/services/lookup-log";

export const normalizeCustomsStatus = (raw: string): TrackingEvent["statusCode"] => {
  const normalized = raw.replace(/\s+/g, "");

  if (
    normalized.includes("수입신고수리") ||
    normalized.includes("수리후반출") ||
    normalized.includes("반출신고") ||
    normalized.includes("통관완료")
  ) {
    return 4;
  }

  if (normalized.includes("수리전")) return 2;

  if (normalized.includes("결재통보") || normalized.includes("심사진행") || normalized.includes("심사중")) return 3;

  if (normalized.includes("입항") || normalized.includes("하선신고수리") || normalized.includes("입항보고수리")) return 1;

  if (
    normalized.includes("반입신고") ||
    normalized.includes("정정") ||
    normalized.includes("보정") ||
    normalized.includes("접수") ||
    normalized.includes("신고")
  ) {
    return 2;
  }

  if (normalized.includes("심사")) return 3;

  return 2;
};

type UnknownRecord = Record<string, unknown>;

const toRecord = (value: unknown): UnknownRecord | null =>
  value && typeof value === "object" ? (value as UnknownRecord) : null;

const getString = (node: UnknownRecord, key: string): string | undefined => {
  const value = node[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
};

const toObjectArray = (value: unknown): UnknownRecord[] => {
  if (Array.isArray(value)) {
    return value.map((item) => toRecord(item)).filter((item): item is UnknownRecord => Boolean(item));
  }

  const asRecord = toRecord(value);
  return asRecord ? [asRecord] : [];
};

const toFlatStringRecord = (node: UnknownRecord): Record<string, string> => {
  const out: Record<string, string> = {};
  Object.keys(node).forEach((key) => {
    const text = getString(node, key);
    if (text) out[key] = text;
  });
  return out;
};

const parseCustomsDatetime = (raw?: string): string => {
  if (!raw) return new Date().toISOString();

  if (/^\d{14}$/.test(raw)) {
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    const hh = raw.slice(8, 10);
    const mm = raw.slice(10, 12);
    const ss = raw.slice(12, 14);
    return `${y}-${m}-${d}T${hh}:${mm}:${ss}+09:00`;
  }

  if (/^\d{8}$/.test(raw)) {
    const y = raw.slice(0, 4);
    const m = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    return `${y}-${m}-${d}T00:00:00+09:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return `${raw.replace(" ", "T")}+09:00`;
  }

  return toIsoOrNow(raw);
};

const mapRowsToEvents = (rows: Record<string, string>[]): TrackingEvent[] =>
  rows
    .map((row): TrackingEvent | null => {
      const status =
        row.csclPrgsStts || row.prgsStts || row.cargTrcnRelaBsopTpcd || row.cargTrcnRelaBsopTpcdNm || row.etprCstmNm;
      if (!status) return null;

      const datetimeRaw = row.prcsDttm || row.prgsDttm || row.dclrDttm || row.rlseDttm || row.etprDt;
      return {
        status,
        statusCode: normalizeCustomsStatus(status),
        datetime: parseCustomsDatetime(datetimeRaw),
        location: row.shedNm || row.locplc || row.entrPortNm || row.prnm || row.dsprNm || row.dclrNo,
        detail: row.rlbrCn || row.bfhnGdncCn || row.rlbrDttm || row.csclPrgsStts || row.dclrNo
      };
    })
    .filter((event): event is TrackingEvent => Boolean(event));

const dedupeEvents = (events: TrackingEvent[]): TrackingEvent[] => {
  const seen = new Set<string>();
  const deduped: TrackingEvent[] = [];

  events.forEach((event) => {
    const key = `${event.status}|${event.datetime}|${event.location ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(event);
  });

  return deduped;
};

const DEFAULT_UNIPASS_URL = "https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo";
const USER_AGENT = "Mozilla/5.0 tracking.tipoasis.com";
const PROXY_SECRET_HEADER = "x-proxy-secret";
const MAX_XML_BYTES = 1_048_576;
/** Offsets from the current year. The first wave runs alone; the second only when the first found nothing. */
const FIRST_WAVE_YEAR_OFFSETS: readonly number[] = [0, -1];
const SECOND_WAVE_YEAR_OFFSETS: readonly number[] = [1, -2, -3, -4];

export type CustomsLookupType = Exclude<TrackingType, "UNKNOWN">;
type UnipassParam = "hblNo" | "mblNo" | "cargMtNo";

const PARAMS_BY_TYPE: Readonly<Record<CustomsLookupType, readonly UnipassParam[]>> = {
  HBL: ["hblNo", "mblNo"],
  DOMESTIC: ["hblNo", "mblNo", "cargMtNo"],
  CARGO: ["cargMtNo"]
};

export type CustomsLookupResult =
  | { readonly kind: "found"; readonly events: TrackingEvent[] }
  /** Every answer was a confirmed "no record"; complete = no call failed, so the route may cache NOT_FOUND. */
  | { readonly kind: "empty"; readonly complete: boolean }
  /** No confirmed UNI-PASS answer at all (timeouts, network errors, non-2xx, unreadable bodies). */
  | { readonly kind: "unavailable"; readonly timedOut: boolean }
  /** No UNIPASS_API_KEY and no proxy: local development. */
  | { readonly kind: "notConfigured" };

export interface CustomsLookupOptions {
  readonly deadline: LookupDeadline;
  readonly onUnipassCall?: (outcome: UnipassCallOutcome) => void;
  /** Called once when the first wave ended without events (or right away without a key); starts customstrack. */
  readonly onFirstWaveEmpty?: () => void;
}

type UnipassCall =
  | { readonly outcome: "answered"; readonly events: TrackingEvent[] }
  | { readonly outcome: "failed"; readonly timedOut: boolean };
type YearCalls = readonly UnipassCall[];

interface WaveRequest {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly trackingNumber: string;
  readonly type: CustomsLookupType;
  readonly year: number;
}

const eventsFromParsedXml = (parsed: unknown): TrackingEvent[] => {
  const root = toRecord(parsed)?.cargCsclPrgsInfoQryRtnVo;
  const rootNode = toRecord(Array.isArray(root) ? root[0] : root) ?? toRecord(parsed);
  if (!rootNode) return [];

  const summaryRows = toObjectArray(rootNode.cargCsclPrgsInfoQryVo).map(toFlatStringRecord);
  const detailRows = toObjectArray(rootNode.cargCsclPrgsInfoDtlQryVo).map(toFlatStringRecord);
  return mapRowsToEvents([...detailRows, ...summaryRows]);
};

/** A UNI-PASS answer is "confirmed" only when it carries the cargCsclPrgsInfoQryRtnVo envelope. */
/** Error answers (wrong or expired key, call quota) arrive in the same envelope with a negative tCnt. */
const isErrorAnswer = (envelope: unknown): boolean => {
  const node = toRecord(Array.isArray(envelope) ? envelope[0] : envelope);
  const count = node ? getString(node, "tCnt") : undefined;
  return count !== undefined && Number(count) < 0;
};

const readUnipassXml = async (xml: string): Promise<{ readonly confirmed: boolean; readonly events: TrackingEvent[] }> => {
  const parsed: unknown = await parseStringPromise(xml, { explicitArray: false, trim: true });
  const envelope = toRecord(parsed)?.cargCsclPrgsInfoQryRtnVo;
  return { confirmed: envelope !== undefined && !isErrorAnswer(envelope), events: eventsFromParsedXml(parsed) };
};

const errorName = (error: unknown): string =>
  typeof error === "object" && error !== null && "name" in error && typeof error.name === "string" ? error.name : "";

const isTimeoutError = (error: unknown): boolean => ["AbortError", "TimeoutError"].includes(errorName(error));

const failedCall = (options: CustomsLookupOptions, timedOut: boolean): UnipassCall => {
  options.onUnipassCall?.("fail");
  return { outcome: "failed", timedOut };
};

/** One UNI-PASS call; headers and body share one cap that never outlives the request deadline. Never rejects. */
const fetchUnipassCall = async (url: string, options: CustomsLookupOptions): Promise<UnipassCall> => {
  const capMs = Math.min(LOOKUP_TIMING.unipassCallMs, options.deadline.remainingMs());
  if (capMs <= 0) return failedCall(options, true);
  const startedAt = Date.now();
  const signal = options.deadline.signal(capMs);
  try {
    const response = await fetch(url, { signal, cache: "no-store", headers: { "user-agent": USER_AGENT } });
    if (!response.ok) return failedCall(options, false);
    const xml = await readTextWithLimit(response, MAX_XML_BYTES, Math.max(1, capMs - (Date.now() - startedAt)));
    const answer = await readUnipassXml(xml);
    if (!answer.confirmed) return failedCall(options, false);
    options.onUnipassCall?.("ok");
    return { outcome: "answered", events: answer.events };
  } catch (error) {
    return failedCall(options, signal.aborted || isTimeoutError(error));
  }
};

const yearUrls = (request: WaveRequest, year: number): string[] =>
  PARAMS_BY_TYPE[request.type].map(
    (param) =>
      `${request.apiUrl}?${new URLSearchParams({ crkyCn: request.apiKey, blYy: String(year), [param]: request.trackingNumber }).toString()}`
  );

const runWave = (offsets: readonly number[], request: WaveRequest, options: CustomsLookupOptions): Promise<YearCalls[]> =>
  Promise.all(
    offsets.map((offset) =>
      Promise.all(yearUrls(request, request.year + offset).map((url) => fetchUnipassCall(url, options)))
    )
  );

/** Events of the first year (in wave order) that has any; later years are ignored so two shipments never mix. */
const firstYearEvents = (years: readonly YearCalls[]): TrackingEvent[] => {
  for (const calls of years) {
    const events = calls.flatMap((call) => (call.outcome === "answered" ? call.events : []));
    if (events.length > 0) return events;
  }
  return [];
};

const countAnswered = (years: readonly YearCalls[]): number =>
  years.reduce((sum, calls) => sum + calls.filter((call) => call.outcome === "answered").length, 0);

const countCalls = (years: readonly YearCalls[]): number => years.reduce((sum, calls) => sum + calls.length, 0);

const anyTimedOut = (years: readonly YearCalls[]): boolean =>
  years.some((calls) => calls.some((call) => call.outcome === "failed" && call.timedOut));

const toFound = (events: TrackingEvent[]): CustomsLookupResult => ({
  kind: "found",
  events: dedupeEvents(events).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
});

/** Wave 1 = current and last year; wave 2 (the other four years, in parallel) only when wave 1 found nothing. */
const lookupDirect = async (request: WaveRequest, options: CustomsLookupOptions): Promise<CustomsLookupResult> => {
  const first = await runWave(FIRST_WAVE_YEAR_OFFSETS, request, options);
  const firstEvents = firstYearEvents(first);
  if (firstEvents.length > 0) return toFound(firstEvents);
  options.onFirstWaveEmpty?.();
  if (countAnswered(first) === 0) return { kind: "unavailable", timedOut: anyTimedOut(first) };

  const second = await runWave(SECOND_WAVE_YEAR_OFFSETS, request, options);
  const secondEvents = firstYearEvents(second);
  if (secondEvents.length > 0) return toFound(secondEvents);
  const all = [...first, ...second];
  return { kind: "empty", complete: countAnswered(all) === countCalls(all) };
};

const getProxyXml = (payload: unknown): string | null => {
  const node = toRecord(payload);
  return typeof node?.xml === "string" ? node.xml : null;
};

type DirectMiss = Extract<CustomsLookupResult, { kind: "unavailable" } | { kind: "notConfigured" }>;

const proxyMissed = (direct: DirectMiss, timedOut: boolean): CustomsLookupResult =>
  direct.kind === "unavailable"
    ? { kind: "unavailable", timedOut: direct.timedOut || timedOut }
    : { kind: "unavailable", timedOut };

/** InsForge proxy: only after every direct call failed (or without a key), bounded by the deadline. Approval 12 removes it. */
const lookupViaProxy = async (
  trackingNumber: string,
  type: CustomsLookupType,
  options: CustomsLookupOptions,
  direct: DirectMiss
): Promise<CustomsLookupResult> => {
  const proxyUrl = process.env.UNIPASS_PROXY_URL;
  const proxySecret = process.env.UNIPASS_PROXY_SECRET;
  const capMs = Math.min(LOOKUP_TIMING.proxyMs, options.deadline.remainingMs());
  if (!proxyUrl || !proxySecret) return direct;
  if (capMs <= 0) return proxyMissed(direct, true);
  const startedAt = Date.now();
  try {
    // The deadline's signal: the proxy call ends with the request (e.g. after a carrier-first answer), not only at its cap.
    const response = await fetch(proxyUrl, {
      method: "POST",
      body: JSON.stringify({ trackingNumber, type }),
      signal: options.deadline.signal(capMs),
      cache: "no-store",
      headers: { "content-type": "application/json", "user-agent": USER_AGENT, [PROXY_SECRET_HEADER]: proxySecret }
    });
    if (!response.ok) return proxyMissed(direct, false);
    const text = await readTextWithLimit(response, MAX_XML_BYTES, Math.max(1, capMs - (Date.now() - startedAt)));
    const xml = getProxyXml(JSON.parse(text) as unknown);
    const answer = xml ? await readUnipassXml(xml) : null;
    if (answer && answer.events.length > 0) return toFound(answer.events);
    return answer?.confirmed ? { kind: "empty", complete: false } : proxyMissed(direct, false);
  } catch (error) {
    return proxyMissed(direct, isTimeoutError(error));
  }
};

/** Looks up UNI-PASS in two waves under one deadline and classifies the outcome. Never rejects. */
export const lookupCustomsEvents = async (
  trackingNumber: string,
  type: CustomsLookupType,
  options: CustomsLookupOptions
): Promise<CustomsLookupResult> => {
  const apiKey = process.env.UNIPASS_API_KEY;
  if (!apiKey) {
    options.onFirstWaveEmpty?.();
    return lookupViaProxy(trackingNumber, type, options, { kind: "notConfigured" });
  }
  const request: WaveRequest = {
    apiUrl: process.env.UNIPASS_API_URL || DEFAULT_UNIPASS_URL,
    apiKey,
    trackingNumber,
    type,
    year: new Date().getFullYear()
  };
  const direct = await lookupDirect(request, options);
  return direct.kind === "unavailable" ? lookupViaProxy(trackingNumber, type, options, direct) : direct;
};
