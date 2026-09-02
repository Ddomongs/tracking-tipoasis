import { z } from "zod";
import { DELIVERY_CARRIER_CODES } from "@/lib/types";
import type { DeliveryCarrierCode } from "@/lib/types";

export const DeliveryCarrierCodeSchema = z.enum(DELIVERY_CARRIER_CODES);

type DeliveryCarrier = {
  readonly code: DeliveryCarrierCode;
  readonly name: string;
  readonly trackingUrl: (invoiceNumber: string) => string;
};

const encoded = (invoiceNumber: string): string => encodeURIComponent(invoiceNumber);

const DELIVERY_CARRIERS: Record<DeliveryCarrierCode, DeliveryCarrier> = {
  AUTO: {
    code: "AUTO",
    name: "택배사 자동 확인",
    trackingUrl: () => ""
  },
  CJ: {
    code: "CJ",
    name: "CJ대한통운",
    trackingUrl: (number) => `https://trace.cjlogistics.com/next/tracking.html?wblNo=${encoded(number)}`
  },
  EPOST: {
    code: "EPOST",
    name: "우체국택배",
    trackingUrl: (number) =>
      `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?displayHeader=N&sid1=${encoded(number)}`
  },
  HANJIN: {
    code: "HANJIN",
    name: "한진택배",
    trackingUrl: (number) =>
      `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${encoded(number)}`
  },
  LOTTE: {
    code: "LOTTE",
    name: "롯데택배",
    trackingUrl: (number) =>
      `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${encoded(number)}`
  },
  LOGEN: {
    code: "LOGEN",
    name: "로젠택배",
    trackingUrl: (number) => `https://www.ilogen.com/web/personal/trace/${encoded(number)}`
  }
};

export const DELIVERY_CARRIER_OPTIONS: readonly DeliveryCarrier[] = [
  DELIVERY_CARRIERS.AUTO,
  DELIVERY_CARRIERS.CJ,
  DELIVERY_CARRIERS.EPOST,
  DELIVERY_CARRIERS.HANJIN,
  DELIVERY_CARRIERS.LOTTE,
  DELIVERY_CARRIERS.LOGEN
];

export const getDeliveryCarrier = (code: DeliveryCarrierCode): DeliveryCarrier => DELIVERY_CARRIERS[code];
