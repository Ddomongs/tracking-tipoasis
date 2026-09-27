import type { GuideKey } from "@/lib/tracking/types";

// Internal-only (contract §11.1 rule 4). 합니다체; no internal labels; no promise to contact the customer later.
// Tokens: {carrier} {staleDays} in CS_TEMPLATES; {date} {holiday} {event} {title} {body} {link} in CS_PHRASES.

export const CS_TEMPLATES: Readonly<Record<GuideKey, { readonly short: string; readonly long: string }>> = {
  idle: {
    short: "조회번호를 알려 주시면 통관과 배송 상태를 바로 확인할 수 있습니다.",
    long: "운송장 번호나 HBL 번호는 주문 안내 문자나 주문내역의 배송조회에서 볼 수 있습니다."
  },
  loading: {
    short: "지금 통관과 배송 정보를 조회하고 있습니다.",
    long: "조회가 끝나면 같은 화면에서 결과를 볼 수 있습니다."
  },
  invalidNumber: {
    short: "보내 주신 번호는 조회번호 형식과 다릅니다. 숫자 10~14자리 운송장 번호나 영문 3~4자로 시작하는 HBL 번호를 확인해 주세요.",
    long: "번호는 주문 안내 문자나 주문내역의 배송조회에서 볼 수 있습니다."
  },
  notFound: {
    short: "이 번호로는 아직 조회되는 정보가 없습니다. 번호가 주문내역과 같다면 한국 도착 전일 수 있습니다.",
    long: "보통 해외 출고 후 3~7일 뒤부터 조회됩니다. 출고 안내를 받은 지 7일이 지나도 조회되지 않으면 다시 말씀해 주세요."
  },
  temporaryDelay: {
    short: "지금 조회 서비스가 잠시 지연되고 있습니다. 번호 문제는 아닙니다.",
    long: "잠시 뒤 아래 링크에서 다시 조회해 주세요."
  },
  offline: {
    short: "인터넷 연결이 끊겨 조회하지 못했습니다.",
    long: "연결을 확인하신 뒤 아래 링크에서 다시 조회해 주세요."
  },
  noResponse: {
    short: "조회 응답이 늦어 결과를 받지 못했습니다.",
    long: "번호가 주문내역과 같은지 확인하신 뒤 아래 링크에서 다시 조회해 주세요."
  },
  serverError: {
    short: "일시적인 오류로 조회하지 못했습니다. 번호 문제는 아닙니다.",
    long: "잠시 뒤 아래 링크에서 다시 조회해 주세요."
  },
  pending: {
    short: "아직 국내 도착·통관 기록이 없습니다. 해외에서 출발한 직후이거나 번호가 다를 수 있습니다.",
    long: "번호가 주문내역의 운송장 번호와 같은지 먼저 확인해 주세요. 출고 안내 후 10일이 지나도 같은 상태면 다시 말씀해 주세요."
  },
  customsArrived: {
    short: "주문하신 상품은 한국에 도착해 통관을 준비하고 있습니다.",
    long: "입항 신고가 끝나면 세관 접수와 심사가 이어집니다."
  },
  customsWaiting: {
    short: "주문하신 상품은 지금 세관 통관 순서를 기다리고 있습니다.",
    long: "세관 접수가 끝났고 순서대로 심사가 진행됩니다."
  },
  customsCleared: {
    short: "주문하신 상품은 통관이 끝나 국내 택배사로 넘어갈 차례입니다.",
    long: "택배사로 넘어가면 운송장 문자가 발송됩니다."
  },
  handedToCarrier: {
    short: "주문하신 상품은 택배사({carrier})로 넘어가 배송을 준비하고 있습니다.",
    long: "배송이 시작되면 택배사 문자가 발송됩니다."
  },
  pickedUp: {
    short: "주문하신 상품은 {carrier} 기사님이 인수해 배송 출발을 준비하고 있습니다.",
    long: "배송이 시작되면 택배사 조회에서 위치를 볼 수 있습니다."
  },
  inTransit: {
    short: "주문하신 상품은 지금 국내 배송 중입니다.",
    long: "정확한 도착 시간은 택배사 문자나 아래 링크의 실시간 조회에서 볼 수 있습니다."
  },
  delivered: {
    short: "주문하신 상품은 배송이 완료되었습니다.",
    long: "받지 못하셨다면 문 앞·경비실·택배함을 먼저 확인해 주세요. 24시간이 지나도 찾지 못하시면 다시 말씀해 주세요."
  },
  stale: {
    short: "주문하신 상품은 {staleDays}일 넘게 새 처리 기록이 없어 확인이 필요합니다.",
    long: "개인통관고유부호와 수취인 이름이 주문 정보와 같은지 확인해 주세요."
  },
  lookupUnavailable: {
    short: "지금 택배사 조회가 잠시 늦어 최신 배송 정보를 불러오지 못했습니다. 번호 문제는 아닙니다.",
    long: "택배사 공식 조회나 아래 링크에서 잠시 뒤 다시 확인해 주세요."
  },
  ambiguous: {
    short: "같은 번호가 여러 택배사에 있어 택배사 확인이 필요합니다.",
    long: "주문 안내 문자에 적힌 택배사를 골라 아래 링크에서 다시 조회해 주세요."
  }
};

export const CS_PHRASES = {
  eta: "도착 예상일은 {date}입니다.",
  etaToday: "도착 예상일은 오늘, {date}입니다.",
  etaHoliday: "도착 예상일은 {date}이며 {holiday} 영향으로 1~2일 늦어질 수 있습니다.",
  deliveredOn: "배송 완료일은 {date}입니다.",
  overdueEta: "처음 안내한 도착 예상일은 {date}입니다.",
  pendingInfo: "도착 예상일은 통관 정보가 등록되면 볼 수 있습니다.",
  withheld: "지금은 도착 예상일을 안내하기 어렵습니다.",
  worry: "{date}까지 변동이 없으면 다시 말씀해 주세요.",
  overdue: "예상보다 늦어지고 있어 확인이 필요합니다.",
  lastEvent: "최근 처리: {event}",
  notice: "안내: {title} - {body}",
  link: "실시간 확인: {link}"
} as const;
