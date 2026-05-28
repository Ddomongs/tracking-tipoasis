import type { TrackingEvent } from "@/lib/types";
import { postFormWithTimeout } from "@/lib/services/http";

const isCjMaintenanceNotice = (text: string): boolean =>
  /상품추적\s*시스템\s*작업\s*공지|서비스\s*점검|시스템\s*점검/i.test(text);

const carrierUnavailableError = (): Error => {
  const error = new Error("CJ delivery tracking service unavailable");
  error.name = "CarrierUnavailableError";
  return error;
};

const normalizeDeliveryStatus = (raw: string): TrackingEvent["statusCode"] => {
  if (raw.includes("인수") || raw.includes("집화") || raw.includes("인계")) return 5;
  if (raw.includes("배송중") || raw.includes("간선") || raw.includes("출고")) return 6;
  if (raw.includes("완료") || raw.includes("배달")) return 7;
  return 6;
};

const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return raw;
};

const extractDeliveryContact = (statusText: string, detailText: string): Pick<TrackingEvent, "driverName" | "driverPhone"> => {
  if (!/(배송출발|배달출발|배송예정)/.test(statusText)) {
    return {};
  }

  const text = detailText.replace(/\s+/g, " ");
  const phoneMatch = text.match(/(01[016789]-?\d{3,4}-?\d{4})/);
  const labelNameMatch = text.match(/(?:배송담당|담당기사|배송기사)\s*[:：]?\s*([가-힣A-Za-z]{2,20})/);
  const phoneIndex = phoneMatch?.index ?? -1;
  const trailingNameMatch = phoneIndex > 0 ? text.slice(0, phoneIndex).match(/([가-힣A-Za-z]{2,20})\s*$/) : null;
  const resolvedName = labelNameMatch?.[1] ?? trailingNameMatch?.[1];

  return {
    driverName: resolvedName,
    driverPhone: phoneMatch?.[1] ? normalizePhone(phoneMatch[1]) : undefined
  };
};

export const fetchDeliveryEvents = async (invoiceNumber: string): Promise<TrackingEvent[]> => {
  const headers = {
    origin: "https://trace.cjlogistics.com",
    referer: `https://trace.cjlogistics.com/next/tracking.html?wblNo=${encodeURIComponent(invoiceNumber)}`
  };

  const response = await postFormWithTimeout(
    "https://trace.cjlogistics.com/next/rest/selectTrackingDetailList.do",
    { wblNo: invoiceNumber },
    12000,
    headers
  );

  if (!response.ok) {
    const text = await response.text();
    if (isCjMaintenanceNotice(text)) {
      throw carrierUnavailableError();
    }
    return [];
  }

  const raw = await response.text();
  if (isCjMaintenanceNotice(raw)) {
    throw carrierUnavailableError();
  }

  let payload: {
    resultCode?: number | string;
    data?: { svcOutList?: Array<Record<string, string>> };
  };

  try {
    payload = JSON.parse(raw) as {
      resultCode?: number | string;
      data?: { svcOutList?: Array<Record<string, string>> };
    };
  } catch {
    return [];
  }

  const resultCode = String(payload.resultCode ?? "");
  if (resultCode !== "200" || !payload.data?.svcOutList?.length) {
    return [];
  }

  const mappedEvents = payload.data.svcOutList.map((item): TrackingEvent | null => {
      const statusText = item.crgStDnm?.trim();
      if (!statusText) {
        return null;
      }

      const workDate = item.workDt?.replaceAll(".", "-") ?? "";
      const workTime = item.workHms ?? "00:00:00";
      const datetime = /^\d{4}-\d{2}-\d{2}$/.test(workDate)
        ? `${workDate}T${workTime}+09:00`
        : new Date().toISOString();
      const rawDetail = [item.crgStDcdVal, item.patnBranNm].filter((value): value is string => Boolean(value)).join(" ");
      const contact = extractDeliveryContact(statusText, rawDetail);

      return {
        status: statusText,
        statusCode: normalizeDeliveryStatus(statusText),
        datetime,
        location: item.branNm || undefined,
        detail: rawDetail || undefined,
        driverName: contact.driverName,
        driverPhone: contact.driverPhone
      };
    });

  const events: TrackingEvent[] = mappedEvents.filter((event): event is TrackingEvent => event !== null);

  return events.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
};
