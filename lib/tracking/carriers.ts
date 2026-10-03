import type { DeliveryCarrierCode } from "@/lib/types";
import type { CarrierView, ConcreteCarrierCode, LookupRequest } from "@/lib/tracking/types";

/** Client-safe twin of lib/delivery-carriers.ts (which imports zod). Parity is tested in tests/unit/carriers.spec.ts. */
export const CONCRETE_CARRIER_CODES: readonly ConcreteCarrierCode[] = ["CJ", "EPOST", "HANJIN", "LOTTE", "LOGEN"];

export const CARRIER_NAMES: Readonly<Record<ConcreteCarrierCode, string>> = {
  CJ: "CJ대한통운",
  EPOST: "우체국택배",
  HANJIN: "한진택배",
  LOTTE: "롯데택배",
  LOGEN: "로젠택배"
};

/** Public customer-center numbers (10월 2일 요청: 배송 완료인데 못 받았을 때 바로 전화). */
export const CARRIER_CENTER_PHONES: Readonly<Record<ConcreteCarrierCode, string>> = {
  CJ: "1588-1255",
  EPOST: "1588-1300",
  HANJIN: "1588-0011",
  LOTTE: "1588-2121",
  LOGEN: "1588-9988"
};

const TRACKING_URL_BUILDERS: Readonly<Record<ConcreteCarrierCode, (encodedNumber: string) => string>> = {
  CJ: (value) => `https://trace.cjlogistics.com/next/tracking.html?wblNo=${value}`,
  EPOST: (value) => `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?displayHeader=N&sid1=${value}`,
  HANJIN: (value) => `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${value}`,
  LOTTE: (value) => `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${value}`,
  LOGEN: (value) => `https://www.ilogen.com/web/personal/trace/${value}`
};

const AUTOMATIC_LABEL_PATTERN = /자동\s*(조회|확인)|자동으로/;

export function isConcreteCarrier(code: DeliveryCarrierCode): code is ConcreteCarrierCode {
  return code !== "AUTO";
}

export function carrierOfficialUrl(code: DeliveryCarrierCode, invoiceNumber: string): string | null {
  if (!isConcreteCarrier(code) || invoiceNumber.length === 0) return null;
  return TRACKING_URL_BUILDERS[code](encodeURIComponent(invoiceNumber));
}

/** A customer-facing carrier name, or null. The internal '택배사 자동 확인' is never returned. */
export function carrierDisplayName(rawName: string | null | undefined, code: DeliveryCarrierCode): string | null {
  const name = rawName?.trim() ?? "";
  if (name.length > 0 && !AUTOMATIC_LABEL_PATTERN.test(name)) return name;
  return isConcreteCarrier(code) ? CARRIER_NAMES[code] : null;
}

/** Carrier view before any data exists (loading, errors). `unknownLabel` is the bar suffix while the carrier is unknown. */
export function requestCarrierView(request: LookupRequest, unknownLabel: string): CarrierView {
  const name = isConcreteCarrier(request.carrier) ? CARRIER_NAMES[request.carrier] : null;
  return {
    code: request.carrier,
    name,
    barLabel: name ?? unknownLabel,
    officialUrl: carrierOfficialUrl(request.carrier, request.number)
  };
}
