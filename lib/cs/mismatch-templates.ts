// Internal-only (contract §11.1 rule 4): SMS drafts for customs-code mismatches, moved from lib/services/cs-reply-template.ts (S04).

export const CUSTOMS_MISMATCH_TEMPLATES = {
  default:
    "안녕하세요. 통관 진행을 위해 수취인명과 개인통관고유부호 정보 확인이 필요합니다.\n주문 시 입력하신 수취인명과 개인통관고유부호가 일치하지 않아 출고 전 확인 단계에 있습니다.\n정확한 수취인명과 개인통관고유부호를 확인 후 회신 부탁드립니다.",
  recipient:
    "안녕하세요. 통관 정보 확인 중 수취인 정보 확인이 필요하여 안내드립니다.\n개인통관고유부호는 수취인 본인 명의와 일치해야 통관이 가능합니다.\n수취인명, 연락처, 개인통관고유부호를 다시 확인 후 회신 부탁드립니다.",
  hold:
    "안녕하세요. 현재 통관정보 불일치로 출고가 보류될 수 있어 안내드립니다.\n정확한 개인통관고유부호 확인 후 회신 주시면 확인 후 진행 도와드리겠습니다."
} as const;

export type CustomsMismatchTemplateKey = keyof typeof CUSTOMS_MISMATCH_TEMPLATES;
