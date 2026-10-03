import type { SiteConfig } from "@/lib/config/types";
import { CARRIER_NAMES, CONCRETE_CARRIER_CODES } from "@/lib/tracking/carriers";
import { fillSlots } from "@/lib/tracking/template";
import type { ActionKind, ActionView, ActionWeight, CarrierChoiceView } from "@/lib/tracking/types";

interface ActionOptions {
  readonly href?: string | null;
  readonly external?: boolean;
  readonly cooldownSeconds?: number | null;
  readonly detail?: string;
}

export function action(kind: ActionKind, label: string, weight: ActionWeight, options: ActionOptions = {}): ActionView {
  return {
    kind,
    label,
    weight,
    href: options.href ?? null,
    external: options.external ?? false,
    cooldownSeconds: options.cooldownSeconds ?? null,
    ...(options.detail === undefined ? {} : { detail: options.detail })
  };
}

export function withWeight(view: ActionView, weight: ActionWeight): ActionView {
  return { ...view, weight };
}

export function talkAction(config: SiteConfig, weight: ActionWeight): ActionView {
  return action("talk", config.channels.talk.labels.cta, weight, { href: config.channels.talk.url, external: true });
}

/** [문의 내용 복사하고 톡톡 열기] — always the one filled primary where it appears. */
export function copyAndTalkAction(config: SiteConfig): ActionView {
  return action("copyAndTalk", config.channels.talk.labels.copyAndTalk, "primary", { href: config.channels.talk.url, external: true });
}

export function fixNumberAction(config: SiteConfig, weight: ActionWeight): ActionView {
  return action("fixNumber", config.resultCopy.actionFixNumber, weight);
}

export function retryAction(config: SiteConfig, weight: ActionWeight, cooldownSeconds: number | null = null): ActionView {
  return action("retry", config.resultCopy.actionRetry, weight, { cooldownSeconds });
}

export function returnLinkAction(config: SiteConfig, weight: ActionWeight): ActionView {
  return action("copyReturnLink", config.resultCopy.actionReturnLink, weight);
}

export function undeliveredAction(config: SiteConfig): ActionView {
  return action("undeliveredHelp", config.resultCopy.actionUndelivered, "text");
}

/**
 * '010-****-5678': the screen (anyone holding the tracking number can open it) shows only the ends of a driver's
 * number; the tel: link dials the full number (10월 2일 요청).
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return "****";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

export function callDriverAction(config: SiteConfig, phone: string): ActionView {
  return action("callDriver", config.resultCopy.actionCallDriver, "secondary", {
    href: `tel:${phone.replace(/[^0-9+]/g, "")}`,
    detail: maskPhone(phone)
  });
}

/** The carrier's public customer center, when no driver number is known (배송 완료 미수령). */
export function callCarrierAction(carrierName: string, phone: string): ActionView {
  return action("callCarrier", `${carrierName} 고객센터`, "secondary", { href: `tel:${phone.replace(/\D/g, "")}`, detail: phone });
}

export function carrierOfficialAction(
  config: SiteConfig, carrierName: string, href: string, weight: ActionWeight, live: boolean
): ActionView {
  const template = live ? config.resultCopy.actionCarrierLive : config.resultCopy.actionCarrierOfficial;
  return action("carrierOfficial", fillSlots(template, { carrier: carrierName }), weight, { href, external: true });
}

export const ALL_CARRIER_CHOICES: readonly CarrierChoiceView[] = CONCRETE_CARRIER_CODES.map((code) => ({ code, name: CARRIER_NAMES[code] }));
