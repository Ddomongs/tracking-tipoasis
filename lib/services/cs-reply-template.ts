import type { TrackResponseData, TrackingEvent } from "@/lib/types";

export type CsReplyTone = "standard" | "delay" | "completed" | "needs_review";

export type CsDeliveryGuide = {
  invoiceNumber: string;
  carrierName: string;
  currentStatus: string;
  latestEvent: Pick<TrackingEvent, "status" | "datetime" | "location" | "detail"> | null;
  reply: string;
  tone: CsReplyTone;
};

export const CUSTOMS_MISMATCH_TEMPLATES = {
  default:
    "안녕하세요. 통관 진행을 위해 수취인명과 개인통관고유부호 정보 확인이 필요합니다.\n주문 시 입력하신 수취인명과 개인통관고유부호가 일치하지 않아 출고 전 확인 단계에 있습니다.\n정확한 수취인명과 개인통관고유부호를 확인 후 회신 부탁드립니다.",
  recipient:
    "안녕하세요. 통관 정보 확인 중 수취인 정보 확인이 필요하여 안내드립니다.\n개인통관고유부호는 수취인 본인 명의와 일치해야 통관이 가능합니다.\n수취인명, 연락처, 개인통관고유부호를 다시 확인 후 회신 부탁드립니다.",
  hold:
    "안녕하세요. 현재 통관정보 불일치로 출고가 보류될 수 있어 안내드립니다.\n정확한 개인통관고유부호 확인 후 회신 주시면 확인 후 진행 도와드리겠습니다."
} as const;

export type CustomsMismatchTemplateKey = keyof typeof CUSTOMS_MISMATCH_TEMPLATES;

const getLatestEvent = (events: TrackingEvent[]): TrackingEvent | null =>
  [...events].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0] ?? null;

const formatDateTime = (datetime: string): string | null => {
  const parsed = new Date(datetime);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const buildLatestEventLine = (event: CsDeliveryGuide["latestEvent"]): string | null => {
  if (!event) return null;

  const dateText = formatDateTime(event.datetime);
  const locationText = event.location ? `, ${event.location}` : "";
  const detailText = event.detail ? ` / ${event.detail}` : "";

  return dateText ? `최근 처리: ${event.status} (${dateText}${locationText}${detailText})` : `최근 처리: ${event.status}`;
};

export const buildCsDeliveryGuide = (data: TrackResponseData): CsDeliveryGuide => {
  const latestDeliveryEvent = getLatestEvent(data.delivery.events);
  const latestCustomsEvent = getLatestEvent(data.customs.events);
  const latestEvent = latestDeliveryEvent ?? latestCustomsEvent;
  const eventLine = buildLatestEventLine(latestEvent);
  const carrierName = data.delivery.carrier || "택배사";
  const invoiceNumber = data.delivery.invoiceNumber || data.trackingNumber;

  if (data.isPending) {
    return {
      invoiceNumber,
      carrierName,
      currentStatus: "도착전",
      latestEvent,
      tone: "delay",
      reply: [
        `현재 ${carrierName} 운송장번호 ${invoiceNumber}는 아직 배송 이력이 확인되지 않습니다.`,
        "상품이 국내 도착 전이거나 택배사 전산 반영 전일 수 있어 확인되는 즉시 안내드리겠습니다."
      ].join("\n")
    };
  }

  if (data.currentStatusCode >= 7) {
    return {
      invoiceNumber,
      carrierName,
      currentStatus: data.currentStatus,
      latestEvent,
      tone: "completed",
      reply: [
        `현재 ${carrierName} 운송장번호 ${invoiceNumber}는 배송완료로 확인됩니다.`,
        eventLine ?? "택배사 배송조회 기준으로 배송이 완료된 상태입니다."
      ].join("\n")
    };
  }

  if (data.delivery.events.length > 0) {
    return {
      invoiceNumber,
      carrierName,
      currentStatus: data.currentStatus,
      latestEvent,
      tone: "standard",
      reply: [
        `현재 ${carrierName} 운송장번호 ${invoiceNumber}는 ${data.currentStatus} 단계로 확인됩니다.`,
        eventLine ?? "택배사 배송조회 기준으로 이동 중입니다."
      ].join("\n")
    };
  }

  if (data.customs.events.length > 0 && data.currentStatusCode >= 4) {
    return {
      invoiceNumber,
      carrierName,
      currentStatus: data.currentStatus,
      latestEvent,
      tone: "delay",
      reply: [
        `현재 ${invoiceNumber}는 통관 완료 후 국내 택배 인계를 기다리는 단계로 확인됩니다.`,
        eventLine ?? "통관 정보는 확인되며, 택배사 배송 이력은 아직 반영 전입니다."
      ].join("\n")
    };
  }

  return {
    invoiceNumber,
    carrierName,
    currentStatus: data.currentStatus,
    latestEvent,
    tone: "needs_review",
    reply: [
      `현재 ${carrierName} 운송장번호 ${invoiceNumber}는 ${data.currentStatus} 단계로 확인됩니다.`,
      eventLine ?? "추가 배송 이력이 확인되는 대로 다시 안내드리겠습니다."
    ].join("\n")
  };
};
