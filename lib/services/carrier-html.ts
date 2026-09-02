import { load } from "cheerio";
import type { Cheerio, CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import { TrackingEventSchema } from "@/lib/schemas";
import type { DeliveryCarrierCode, StatusCode, TrackingEvent } from "@/lib/types";

type ColumnMap = {
  readonly date: number;
  readonly time: number;
  readonly location: number;
  readonly status: number;
  readonly detail: number;
};

const clean = (value: string): string => value.replace(/\s+/g, " ").trim();

const findColumn = (headers: readonly string[], patterns: readonly RegExp[]): number =>
  headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));

const mapColumns = (headers: readonly string[]): ColumnMap => ({
  date: findColumn(headers, [/날짜/, /일자/, /처리일/]),
  time: findColumn(headers, [/시간/, /일시/]),
  location: findColumn(headers, [/발생국/, /상품위치/, /현재위치/, /처리점소/, /영업소/, /위치/]),
  status: findColumn(headers, [/처리현황/, /진행상황/, /배송상태/, /처리상태/, /상태/]),
  detail: findColumn(headers, [/상세/, /내용/, /비고/])
});

const valueAt = (values: readonly string[], index: number): string => (index >= 0 ? values[index] ?? "" : "");

const normalizeDateTime = (dateText: string, timeText: string): string | undefined => {
  const combined = clean(`${dateText} ${timeText}`);
  const match = combined.match(/(20\d{2})[.\/-]\s*(\d{1,2})[.\/-]\s*(\d{1,2})(?:\s+|T)?(\d{1,2})?:?(\d{2})?:?(\d{2})?/);
  if (!match) return undefined;

  const [, year, rawMonth, rawDay, rawHour, rawMinute, rawSecond] = match;
  if (!year || !rawMonth || !rawDay) return undefined;

  const month = rawMonth.padStart(2, "0");
  const day = rawDay.padStart(2, "0");
  const hour = (rawHour ?? "00").padStart(2, "0");
  const minute = (rawMinute ?? "00").padStart(2, "0");
  const second = (rawSecond ?? "00").padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
};

const statusCodeFor = (status: string): StatusCode => {
  if (/배달완료|배송완료|수취완료|수령완료/.test(status)) return 7;
  if (/접수|인수|집화|집하|인계/.test(status)) return 5;
  if (/완료|수취|수령/.test(status)) return 7;
  return 6;
};

const headersFor = ($: CheerioAPI, table: Cheerio<AnyNode>): string[] =>
  table
    .find("tr")
    .first()
    .find("th")
    .map((_, element) => clean($(element).text()))
    .get();

const tableMatchesCarrier = (carrierCode: DeliveryCarrierCode, headers: readonly string[]): boolean => {
  const joined = headers.join(" ");
  if (carrierCode === "EPOST") return /발생국/.test(joined) && /처리현황/.test(joined);
  if (carrierCode === "HANJIN") return /상품위치/.test(joined) && /배송 진행상황|진행상황/.test(joined);
  if (carrierCode === "LOTTE") return /현재위치/.test(joined) && /처리현황/.test(joined);
  if (carrierCode === "LOGEN") return /처리점소|영업소|위치/.test(joined) && /상태|현황/.test(joined);
  return false;
};

const parseTable = ($: CheerioAPI, table: Cheerio<AnyNode>, headers: readonly string[]): TrackingEvent[] => {
  const columns = mapColumns(headers);
  if (columns.status < 0 || (columns.date < 0 && columns.time < 0)) return [];

  const events: TrackingEvent[] = [];
  table.find("tr").each((_, row) => {
    const values = $(row)
      .find("td")
      .map((__, cell) => clean($(cell).text()))
      .get();
    if (values.length === 0) return;

    const status = valueAt(values, columns.status);
    const dateValue = valueAt(values, columns.date);
    const timeValue = valueAt(values, columns.time);
    const datetime = normalizeDateTime(dateValue, columns.date === columns.time ? "" : timeValue);
    if (!status || !datetime) return;

    const location = valueAt(values, columns.location);
    const detail = valueAt(values, columns.detail);
    events.push({
      status,
      statusCode: statusCodeFor(status),
      datetime,
      location: location || undefined,
      detail: detail || undefined
    });
  });

  const sorted = events.sort((left, right) => new Date(left.datetime).getTime() - new Date(right.datetime).getTime());
  const parsed = TrackingEventSchema.array().safeParse(sorted);
  return parsed.success ? parsed.data : [];
};

export const parseCarrierTrackingHtml = (carrierCode: DeliveryCarrierCode, html: string): TrackingEvent[] => {
  if (carrierCode === "AUTO" || carrierCode === "CJ") return [];

  const $ = load(html);
  for (const element of $("table").toArray()) {
    const table = $(element);
    const headers = headersFor($, table);
    if (tableMatchesCarrier(carrierCode, headers)) {
      const events = parseTable($, table, headers);
      if (events.length > 0) return events;
    }
  }
  return [];
};
