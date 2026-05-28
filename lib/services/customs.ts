import { parseStringPromise } from "xml2js";
import type { TrackingEvent, TrackingType } from "@/lib/types";
import { toIsoOrNow } from "@/lib/utils";
import { fetchWithTimeout } from "@/lib/services/http";

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

const buildCustomsRequestUrls = (apiUrl: string, apiKey: string, trackingNumber: string, type: TrackingType): string[] => {
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2, thisYear - 3, thisYear - 4, thisYear + 1];

  if (type === "CARGO") {
    return years.map((year) => {
      const params = new URLSearchParams({
        crkyCn: apiKey,
        cargMtNo: trackingNumber,
        blYy: String(year)
      });
      return `${apiUrl}?${params.toString()}`;
    });
  }

  if (type === "HBL") {
    return years.flatMap((year) => {
      const common = { crkyCn: apiKey, blYy: String(year) };
      return [
        `${apiUrl}?${new URLSearchParams({ ...common, hblNo: trackingNumber }).toString()}`,
        `${apiUrl}?${new URLSearchParams({ ...common, mblNo: trackingNumber }).toString()}`
      ];
    });
  }

  if (type === "DOMESTIC") {
    return years.flatMap((year) => {
      const common = { crkyCn: apiKey, blYy: String(year) };
      return [
        `${apiUrl}?${new URLSearchParams({ ...common, hblNo: trackingNumber }).toString()}`,
        `${apiUrl}?${new URLSearchParams({ ...common, mblNo: trackingNumber }).toString()}`,
        `${apiUrl}?${new URLSearchParams({ ...common, cargMtNo: trackingNumber }).toString()}`
      ];
    });
  }

  return [];
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

export const fetchCustomsEvents = async (trackingNumber: string, type: TrackingType): Promise<TrackingEvent[]> => {
  const apiKey = process.env.UNIPASS_API_KEY;
  if (!apiKey) {
    return [];
  }

  const apiUrl =
    process.env.UNIPASS_API_URL ||
    "https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo";

  const urls = buildCustomsRequestUrls(apiUrl, apiKey, trackingNumber, type);
  const collected: TrackingEvent[] = [];

  for (const url of urls) {
    const response = await fetchWithTimeout(url, 12000);
    if (!response.ok) {
      continue;
    }

    const xml = await response.text();
    const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });
    const root = toRecord(parsed)?.cargCsclPrgsInfoQryRtnVo;
    const rootNode = toRecord(Array.isArray(root) ? root[0] : root) ?? toRecord(parsed);
    if (!rootNode) {
      continue;
    }

    const summaryRows = toObjectArray(rootNode.cargCsclPrgsInfoQryVo).map(toFlatStringRecord);
    const detailRows = toObjectArray(rootNode.cargCsclPrgsInfoDtlQryVo).map(toFlatStringRecord);
    const rows = [...detailRows, ...summaryRows];
    const events = mapRowsToEvents(rows);
    if (events.length > 0) {
      collected.push(...events);
      break;
    }
  }

  return dedupeEvents(collected).sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
};
