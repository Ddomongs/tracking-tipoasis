import { z } from "zod";
import { getDeliveryCarrier } from "@/lib/delivery-carriers";
import { parseCarrierTrackingHtml } from "@/lib/services/carrier-html";
import { fetchWithTimeout, postFormWithTimeout, readTextWithLimit } from "@/lib/services/http";
import type { DeliveryCarrierCode, DeliveryLookupResult, TrackingEvent } from "@/lib/types";

const CjItemSchema = z.object({
  crgStDnm: z.string().optional(),
  crgStDcdVal: z.string().optional(),
  patnBranNm: z.string().optional(),
  branNm: z.string().optional(),
  workDt: z.string().optional(),
  workHms: z.string().optional()
});

const CjResponseSchema = z.object({
  resultCode: z.union([z.number(), z.string()]).optional(),
  data: z
    .object({
      svcOutList: z.array(CjItemSchema).optional()
    })
    .optional()
});

class CarrierUnavailableError extends Error {
  constructor(carrierName: string) {
    super(`${carrierName} delivery tracking service unavailable`);
    this.name = "CarrierUnavailableError";
  }
}

const isCarrierUnavailableNotice = (text: string): boolean =>
  /서비스\s*점검|시스템\s*점검|temporarily\s+unavailable|service\s+unavailable|access\s+denied/i.test(text);

const isCjMaintenanceNotice = (text: string): boolean =>
  /상품추적\s*시스템\s*작업\s*공지|서비스\s*점검|시스템\s*점검/i.test(text);

const normalizeDeliveryStatus = (raw: string): TrackingEvent["statusCode"] => {
  if (/배달완료|배송완료|수취완료|수령완료/.test(raw)) return 7;
  if (/인수|집화|집하|인계|접수/.test(raw)) return 5;
  if (/완료|수취|수령/.test(raw)) return 7;
  return 6;
};

const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return raw;
};

const extractDeliveryContact = (
  statusText: string,
  detailText: string
): Pick<TrackingEvent, "driverName" | "driverPhone"> => {
  if (!/(배송출발|배달출발|배송예정)/.test(statusText)) return {};

  const text = detailText.replace(/\s+/g, " ");
  const phoneMatch = text.match(/(01[016789]-?\d{3,4}-?\d{4})/);
  const labelNameMatch = text.match(/(?:배송담당|담당기사|배송기사)\s*[:：]?\s*([가-힣A-Za-z]{2,20})/);
  const phoneIndex = phoneMatch?.index ?? -1;
  const trailingNameMatch = phoneIndex > 0 ? text.slice(0, phoneIndex).match(/([가-힣A-Za-z]{2,20})\s*$/) : null;

  return {
    driverName: labelNameMatch?.[1] ?? trailingNameMatch?.[1],
    driverPhone: phoneMatch?.[1] ? normalizePhone(phoneMatch[1]) : undefined
  };
};

const parseCjResponse = (raw: string): TrackingEvent[] => {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return [];
  }

  const parsed = CjResponseSchema.safeParse(json);
  if (!parsed.success || String(parsed.data.resultCode ?? "") !== "200") return [];

  const events = (parsed.data.data?.svcOutList ?? []).flatMap((item): TrackingEvent[] => {
    const status = item.crgStDnm?.trim();
    if (!status) return [];

    const workDate = item.workDt?.replaceAll(".", "-") ?? "";
    const workTime = item.workHms ?? "00:00:00";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return [];

    const detail = [item.crgStDcdVal, item.patnBranNm]
      .filter((value): value is string => Boolean(value))
      .join(" ");
    const contact = extractDeliveryContact(status, detail);
    return [
      {
        status,
        statusCode: normalizeDeliveryStatus(status),
        datetime: `${workDate}T${workTime}+09:00`,
        location: item.branNm || undefined,
        detail: detail || undefined,
        driverName: contact.driverName,
        driverPhone: contact.driverPhone
      }
    ];
  });

  return events.sort((left, right) => new Date(left.datetime).getTime() - new Date(right.datetime).getTime());
};

const fetchCjEvents = async (invoiceNumber: string): Promise<TrackingEvent[]> => {
  const response = await postFormWithTimeout(
    "https://trace.cjlogistics.com/next/rest/selectTrackingDetailList.do",
    { wblNo: invoiceNumber },
    12000,
    {
      origin: "https://trace.cjlogistics.com",
      referer: getDeliveryCarrier("CJ").trackingUrl(invoiceNumber)
    },
    "manual"
  );
  const raw = await readTextWithLimit(response, 262_144, 12000);
  if (!response.ok) throw new CarrierUnavailableError("CJ대한통운");
  const events = parseCjResponse(raw);
  if (events.length > 0) return events;
  if (isCjMaintenanceNotice(raw)) throw new CarrierUnavailableError("CJ대한통운");
  return [];
};

const fetchOfficialHtmlEvents = async (
  carrierCode: Exclude<DeliveryCarrierCode, "AUTO" | "CJ">,
  invoiceNumber: string
): Promise<TrackingEvent[]> => {
  const response = await fetchWithTimeout(getDeliveryCarrier(carrierCode).trackingUrl(invoiceNumber), 12000, "manual");
  if (!response.ok) throw new CarrierUnavailableError(getDeliveryCarrier(carrierCode).name);
  const html = await readTextWithLimit(response, 1_048_576, 12000);
  const events = parseCarrierTrackingHtml(carrierCode, html);
  if (events.length > 0) return events;
  if (isCarrierUnavailableNotice(html)) throw new CarrierUnavailableError(getDeliveryCarrier(carrierCode).name);
  return [];
};

const fetchCarrier = async (
  carrierCode: Exclude<DeliveryCarrierCode, "AUTO">,
  invoiceNumber: string
): Promise<DeliveryLookupResult> => {
  const carrier = getDeliveryCarrier(carrierCode);
  const events =
    carrierCode === "CJ" ? await fetchCjEvents(invoiceNumber) : await fetchOfficialHtmlEvents(carrierCode, invoiceNumber);
  return {
    carrier: carrier.name,
    carrierCode,
    trackingUrl: carrier.trackingUrl(invoiceNumber),
    events
  };
};

const autoCandidates = (invoiceNumber: string): readonly Exclude<DeliveryCarrierCode, "AUTO">[] => {
  const length = invoiceNumber.replace(/\D/g, "").length;
  if (length === 14) return ["EPOST", "CJ", "LOTTE"];
  if (length === 13) return ["EPOST", "LOTTE", "CJ"];
  if (length === 12) return ["CJ", "HANJIN", "LOTTE"];
  if (length === 11) return ["LOGEN", "CJ", "LOTTE"];
  if (length === 10) return ["CJ", "LOGEN"];
  return ["CJ", "EPOST", "HANJIN"];
};

export const fetchDeliveryTracking = async (
  invoiceNumber: string,
  requestedCarrier: DeliveryCarrierCode
): Promise<DeliveryLookupResult> => {
  if (requestedCarrier !== "AUTO") return fetchCarrier(requestedCarrier, invoiceNumber);

  const results = await Promise.all(
    autoCandidates(invoiceNumber).map(async (carrierCode): Promise<DeliveryLookupResult | undefined> => {
      try {
        return await fetchCarrier(carrierCode, invoiceNumber);
      } catch {
        return undefined;
      }
    })
  );
  const matches = results.filter((result): result is DeliveryLookupResult => Boolean(result?.events.length));
  const providerUnavailable = results.some((result) => result === undefined);
  if (providerUnavailable) {
    return {
      carrier: getDeliveryCarrier("AUTO").name,
      carrierCode: "AUTO",
      lookupUnavailable: true,
      events: []
    };
  }

  if (matches.length === 1 && matches[0]) return matches[0];
  if (matches.length > 1) {
    return {
      carrier: "택배사를 선택해 주세요",
      carrierCode: "AUTO",
      ambiguous: true,
      events: []
    };
  }

  return {
    carrier: getDeliveryCarrier("AUTO").name,
    carrierCode: "AUTO",
    events: []
  };
};
