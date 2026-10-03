import type { SiteConfig } from "@/lib/config/types";
import {
  ALL_CARRIER_CHOICES, callCarrierAction, callDriverAction, carrierOfficialAction, copyAndTalkAction, fixNumberAction, retryAction, returnLinkAction,
  talkAction, undeliveredAction
} from "@/lib/tracking/derive/actions";
import { CARRIER_CENTER_PHONES, CARRIER_NAMES, isConcreteCarrier } from "@/lib/tracking/carriers";
import { latestEvent } from "@/lib/tracking/derive/events";
import type { TimedEvent } from "@/lib/tracking/derive/events";
import type { DataGuideKey } from "@/lib/tracking/derive/keys";
import { fillCopy } from "@/lib/tracking/template";
import type { CopyToken } from "@/lib/tracking/template";
import type { KstDateKey } from "@/lib/tracking/time";
import type {
  ActionView, ActionWeight, CarrierView, NextActionView, StoreLinkView, StoreLinksView, StorePlacementId, WorryLineView
} from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

export interface NextActionInput {
  readonly data: TrackResponseData;
  readonly key: DataGuideKey;
  readonly overdue: boolean;
  readonly carrier: CarrierView;
  readonly worryKey: KstDateKey | null;
  readonly events: readonly TimedEvent[];
  readonly values: Readonly<Partial<Record<CopyToken, string>>>;
  readonly config: SiteConfig;
}

/** Overdue customs states also ask the customer to check the customs ID and recipient name. */
const CUSTOMS_NOTE_KEYS: ReadonlySet<DataGuideKey> = new Set<DataGuideKey>(["customsArrived", "customsWaiting", "customsCleared"]);

function storesFor(placement: StorePlacementId, config: SiteConfig, intro: string | null): StoreLinksView {
  const links: StoreLinkView[] = (["naver", "coupang"] as const).map((channel, index) => {
    const store = config.channels[channel];
    const weight: ActionWeight = placement === "deliveredLead" && index === 0 ? "primary" : "secondary";
    return { channel, label: store.linkLabel, href: store.urls[placement], isAffiliate: store.isAffiliate, weight };
  });
  return { placement, intro, disclosure: links.some((link) => link.isAffiliate) ? config.disclosures.coupang : null, links };
}

function officialAction(input: NextActionInput, weight: ActionWeight, live: boolean): ActionView | null {
  const { carrier, config } = input;
  if (carrier.officialUrl === null) return null;
  return carrierOfficialAction(config, carrier.name ?? config.resultCopy.carrierUnknown, carrier.officialUrl, weight, live);
}

function worryLine(input: NextActionInput): WorryLineView | null {
  const { key, overdue, worryKey, config, values } = input;
  const template = config.stateGuide[key].worry;
  if (overdue || template === null) return null;
  if (worryKey !== null) return { dateKey: worryKey, text: fillCopy(template, values), talk: talkAction(config, "text") };
  if (key === "pending") return { dateKey: null, text: fillCopy(template, values), talk: talkAction(config, "text") };
  return null;
}

function carrierCenterAction(input: NextActionInput): ActionView | null {
  const code = input.carrier.code;
  if (!isConcreteCarrier(code)) return null;
  return callCarrierAction(input.carrier.name ?? CARRIER_NAMES[code], CARRIER_CENTER_PHONES[code]);
}

function latestDriverPhone(events: readonly TimedEvent[]): string | null {
  const withPhone = latestEvent(events, (item) => item.source === "delivery" && (item.event.driverPhone ?? "").trim().length > 0);
  return withPhone?.event.driverPhone ?? null;
}

function sharedParts(input: NextActionInput): Omit<NextActionView, "primary" | "secondary"> {
  const { key, config, values, data } = input;
  const row = config.stateGuide[key];
  return {
    heading: row.ctaHeading,
    sentence: fillCopy(row.nextAction, values),
    worry: worryLine(input),
    stores: null,
    carrierChoices: key === "ambiguous" || data.delivery.ambiguous === true ? ALL_CARRIER_CHOICES : null,
    note: null
  };
}

function overdueAction(input: NextActionInput): NextActionView {
  const { key, config } = input;
  const official = officialAction(input, "secondary", false);
  return {
    ...sharedParts(input),
    sentence: config.resultCopy.overdueSentence,
    primary: copyAndTalkAction(config),
    secondary: official === null ? [] : [official],
    worry: null,
    note: CUSTOMS_NOTE_KEYS.has(key) ? config.resultCopy.customsCheckNote : null
  };
}

/** 지금 할 일: one sentence, at most one filled primary, 0–2 secondary actions, per the state table (spec §7). */
export function nextActionForData(input: NextActionInput): NextActionView {
  const { key, overdue, config } = input;
  if (overdue) return overdueAction(input);
  const shared = sharedParts(input);
  const copy = config.resultCopy;
  switch (key) {
    case "pending":
      return {
        ...shared,
        primary: fixNumberAction(config, "primary"),
        secondary: [talkAction(config, "secondary"), returnLinkAction(config, "text")],
        stores: storesFor("pending", config, copy.pendingStoresIntro),
        note: config.durations.pendingRecheck
      };
    case "customsArrived":
    case "customsWaiting":
    case "customsCleared":
      return { ...shared, primary: null, secondary: [returnLinkAction(config, "secondary")] };
    case "handedToCarrier":
    case "pickedUp":
      return { ...shared, primary: officialAction(input, "primary", false), secondary: [returnLinkAction(config, "secondary")] };
    case "inTransit": {
      const phone = latestDriverPhone(input.events);
      return {
        ...shared,
        primary: officialAction(input, "primary", true),
        secondary: phone === null
          ? [talkAction(config, "text"), returnLinkAction(config, "text")]
          : [callDriverAction(config, phone), talkAction(config, "text")]
      };
    }
    case "delivered": {
      // 받지 못했을 때 바로 연락할 곳 (10월 2일 요청): the driver when the carrier gave a number, else its customer center.
      const phone = latestDriverPhone(input.events);
      const call = phone !== null ? callDriverAction(config, phone) : carrierCenterAction(input);
      return {
        ...shared,
        primary: null,
        secondary: [talkAction(config, "secondary"), undeliveredAction(config)],
        ...(call === null ? {} : { contact: call }),
        stores: storesFor("deliveredLead", config, null)
      };
    }
    case "stale": {
      const official = officialAction(input, "secondary", false);
      return { ...shared, primary: copyAndTalkAction(config), secondary: official === null ? [] : [official], note: copy.customsCheckNote };
    }
    case "lookupUnavailable": {
      const official = officialAction(input, "primary", false);
      const secondary = [retryAction(config, "secondary"), talkAction(config, "text")];
      return official === null
        ? { ...shared, sentence: copy.chooseCarrierSentence, primary: null, secondary, carrierChoices: ALL_CARRIER_CHOICES }
        : { ...shared, primary: official, secondary };
    }
    case "ambiguous":
      return { ...shared, primary: null, secondary: [talkAction(config, "text")] };
  }
}
