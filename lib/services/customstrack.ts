import * as cheerio from "cheerio";
import type { TrackingEvent } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/services/http";
import { normalizeCustomsStatus } from "@/lib/services/customs";

const CUSTOMSTRACK_BASE_URL = "https://www.customstrack.com";

const CUSTOMS_STATUS_LABELS = [
  "입항적재화물목록 운항정보 정정",
  "입항적재화물목록 심사완료",
  "입항적재화물목록 제출",
  "통관목록심사완료",
  "수입신고수리",
  "보세운송신고수리",
  "하선신고 수리",
  "입항보고 수리",
  "입항보고 제출",
  "하기신고 수리",
  "통관목록접수",
  "반출신고",
  "반입신고",
  "수입신고",
  "결재통보"
].sort((a, b) => b.length - a.length);

const normalizeSpaces = (value: string): string => value.replace(/\s+/g, " ").trim();

const toCustomstrackDatetime = (raw: string): string => `${raw.replace(" ", "T")}:00+09:00`;

const splitCustomstrackEventText = (raw: string): Pick<TrackingEvent, "status" | "location" | "detail"> | null => {
  const text = normalizeSpaces(raw);
  if (!text) return null;

  const status = CUSTOMS_STATUS_LABELS.find((label) => text.startsWith(label));
  if (!status) {
    const [fallbackStatus, ...rest] = text.split(" ");
    return fallbackStatus
      ? {
          status: fallbackStatus,
          detail: rest.join(" ") || undefined
        }
      : null;
  }

  const remainder = normalizeSpaces(text.slice(status.length));
  if (!remainder) {
    return { status };
  }

  if (remainder.endsWith(status)) {
    const location = normalizeSpaces(remainder.slice(0, -status.length));
    return {
      status,
      location: location || undefined,
      detail: status
    };
  }

  return {
    status,
    detail: remainder
  };
};

const parseCustomstrackEvents = (html: string): TrackingEvent[] => {
  const $ = cheerio.load(html);
  $("script,style").remove();

  const text = normalizeSpaces($("body").text());
  const sectionMatch = text.match(/통관 진행\s+\d+건\s+([\s\S]*?)\s+배송 진행/);
  if (!sectionMatch?.[1]) {
    return [];
  }

  const section = normalizeSpaces(sectionMatch[1]);
  const datePattern = /\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/g;
  const events: TrackingEvent[] = [];
  let previousIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = datePattern.exec(section)) !== null) {
    const eventText = section.slice(previousIndex, match.index);
    previousIndex = match.index + match[0].length;

    const eventParts = splitCustomstrackEventText(eventText);
    if (!eventParts) {
      continue;
    }

    events.push({
      ...eventParts,
      statusCode: normalizeCustomsStatus(eventParts.status),
      datetime: toCustomstrackDatetime(match[0])
    });
  }

  return events.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
};

export const fetchCustomstrackCustomsEvents = async (trackingNumber: string): Promise<TrackingEvent[]> => {
  const response = await fetchWithTimeout(`${CUSTOMSTRACK_BASE_URL}/${encodeURIComponent(trackingNumber)}`, 12000);
  if (!response.ok) {
    return [];
  }

  const html = await response.text();
  return parseCustomstrackEvents(html);
};
