import { durations, resultCopy } from "@/config/site.config";
import type { Notice } from "@/lib/config/types";
import { CS_PHRASES, CS_TEMPLATES } from "@/lib/cs/cs-templates";
import { SITE_ORIGIN } from "@/lib/site";
import { activeNotices } from "@/lib/tracking/notices";
import { fillSlots } from "@/lib/tracking/template";
import { formatKstDateTight } from "@/lib/tracking/time";
import type { EtaView, TrackingViewModel } from "@/lib/tracking/types";

// Internal-only (contract §11.1 rule 4): imported by the CS desk, never by public pages.

export interface CsReply {
  readonly short: string;
  readonly long: string;
  readonly customerLink: string;
}

function etaSentence(eta: EtaView): string | null {
  switch (eta.kind) {
    case "date":
      return fillSlots(CS_PHRASES.eta, { date: formatKstDateTight(eta.date.key) });
    case "today":
      return fillSlots(CS_PHRASES.etaToday, { date: formatKstDateTight(eta.date.key) });
    case "holidayAffected":
      return fillSlots(CS_PHRASES.etaHoliday, { date: formatKstDateTight(eta.date.key), holiday: eta.holidayName });
    case "overdue":
      return fillSlots(CS_PHRASES.overdueEta, { date: formatKstDateTight(eta.date.key) });
    case "deliveredOn":
      return fillSlots(CS_PHRASES.deliveredOn, { date: formatKstDateTight(eta.date.key) });
    case "pendingInfo":
      return CS_PHRASES.pendingInfo;
    case "withheld":
      return CS_PHRASES.withheld;
    case "unknown":
    case "none":
      return null;
  }
}

const isText = (value: string | null): value is string => value !== null && value.length > 0;

/** Short and long replies from the same view model the customer sees (spec §10 답변 생성). */
export function buildCsReply(
  view: TrackingViewModel,
  context: { readonly now: Date; readonly notices: readonly Notice[] }
): CsReply {
  const customerLink = view.guideKey === "invalidNumber" ? `${SITE_ORIGIN}/` : view.returnLink;
  const template = CS_TEMPLATES[view.guideKey];
  const values = { carrier: view.carrier.name ?? resultCopy.carrierUnknown, staleDays: String(durations.staleDays) };
  const status = fillSlots(template.short, values);
  const overdue = view.overdue ? CS_PHRASES.overdue : null;
  const eta = etaSentence(view.eta);
  const worryKey = view.nextAction.worry?.dateKey ?? null;
  const worry = worryKey === null ? null : fillSlots(CS_PHRASES.worry, { date: formatKstDateTight(worryKey) });
  const lastEvent = view.lastEvent === null ? null : fillSlots(CS_PHRASES.lastEvent, { event: view.lastEvent.text });
  const notices = activeNotices(context.notices, context.now, { kind: "cs" })
    .map((notice) => fillSlots(CS_PHRASES.notice, { title: notice.title, body: notice.body }));
  const link = fillSlots(CS_PHRASES.link, { link: customerLink });
  return {
    short: [status, overdue, eta, worry, link].filter(isText).join(" "),
    long: [status, fillSlots(template.long, values), overdue, lastEvent, eta, worry, ...notices, link].filter(isText).join("\n"),
    customerLink
  };
}
