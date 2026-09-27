import type { SiteConfig } from "@/lib/config/types";
import { pickNotice, toNoticeView } from "@/lib/tracking/notices";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import type { EtaView, GuideKey, HelpItemView, NoticeView, NumberView, RevenueView } from "@/lib/tracking/types";

export const NO_REVENUE: RevenueView = {
  tier: "none", stores: "none", recommendations: "none", recommendationContext: null, adsAllowed: false
};

const DOCUMENT_TITLE_SUFFIX = " · 배송 조회";

export function numberView(raw: string): NumberView {
  return { raw, grouped: groupTrackingNumber(raw) };
}

export function noticeFor(config: SiteConfig, now: Date, key: GuideKey): NoticeView | null {
  const notice = pickNotice(config.notices, now, { kind: "result", guideKey: key });
  return notice === null ? null : toNoticeView(notice);
}

export function helpFor(config: SiteConfig, key: GuideKey): readonly HelpItemView[] {
  return config.help
    .filter((entry) => entry.showIn.includes(key))
    .map((entry) => ({ id: entry.id, summary: entry.summary, body: entry.body, defaultOpen: entry.openIn.includes(key) }));
}

/** `${docTitle} · 배송 조회` — docTitle never contains digits (config invariant), so the number never reaches the title. */
export function documentTitleFor(docTitle: string): string {
  return `${docTitle}${DOCUMENT_TITLE_SUFFIX}`;
}

/** One sentence for the polite live region: the status title plus the ETA line. */
export function liveMessageFor(title: string, eta: EtaView): string {
  switch (eta.kind) {
    case "none":
      return title;
    case "pendingInfo":
    case "withheld":
    case "unknown":
      return `${title} · ${eta.label} ${eta.text}`;
    case "date":
    case "today":
    case "holidayAffected":
    case "overdue":
    case "deliveredOn":
      return `${title} · ${eta.label} ${eta.date.label}`;
  }
}
