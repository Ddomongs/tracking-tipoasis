import type { SiteConfig } from "@/lib/config/types";
import { buildReturnLink } from "@/lib/site";
import { retryAction } from "@/lib/tracking/derive/actions";
import { carrierForData } from "@/lib/tracking/derive/carrier-view";
import { etaFor } from "@/lib/tracking/derive/eta";
import { latestEvent, timedEvents } from "@/lib/tracking/derive/events";
import type { TimedEvent } from "@/lib/tracking/derive/events";
import { historyFor, lastEventFor } from "@/lib/tracking/derive/history";
import { codeGuideKey, ctaStateFor, dataGuideKey } from "@/lib/tracking/derive/keys";
import type { DataGuideKey } from "@/lib/tracking/derive/keys";
import { nextActionForData } from "@/lib/tracking/derive/next-action";
import { NO_REVENUE, documentTitleFor, helpFor, liveMessageFor, noticeFor, numberView } from "@/lib/tracking/derive/shared";
import { spineFor } from "@/lib/tracking/derive/spine";
import { isOverdue, worryDateKey } from "@/lib/tracking/derive/worry";
import { buildInquiryCopy } from "@/lib/tracking/inquiry-copy";
import { fillCopy } from "@/lib/tracking/template";
import type { CopyToken } from "@/lib/tracking/template";
import { formatKstDateTight } from "@/lib/tracking/time";
import type { KstDateKey } from "@/lib/tracking/time";
import { OVERDUE_CAPABLE_KEYS } from "@/lib/tracking/types";
import type { EtaView, GuideKey, LookupRequest, RecommendationContext, RevenueView, TrackingViewModel } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

const OVERDUE_KEYS: ReadonlySet<GuideKey> = new Set<GuideKey>(OVERDUE_CAPABLE_KEYS);

const RECOMMENDATION_CONTEXT: Readonly<Partial<Record<DataGuideKey, RecommendationContext>>> = {
  pending: "pending",
  customsArrived: "customsWaiting",
  customsWaiting: "customsWaiting",
  customsCleared: "customsCleared",
  handedToCarrier: "customsCleared",
  pickedUp: "customsCleared",
  inTransit: "inTransit",
  delivered: "delivered"
};

function copyValues(
  eta: EtaView, worryKey: KstDateKey | null, last: TimedEvent | null, carrierName: string, config: SiteConfig
): Readonly<Record<CopyToken, string>> {
  const etaKey = "date" in eta ? eta.date.key : null;
  return {
    etaDate: etaKey === null ? "" : formatKstDateTight(etaKey),
    worryDate: worryKey === null ? "" : formatKstDateTight(worryKey),
    lastEventDate: last === null ? "" : formatKstDateTight(last.at),
    carrier: carrierName,
    staleDays: String(config.durations.staleDays)
  };
}

/** Overdue → no stores, recommendations or ads (spec §7 overdue, §8). */
function revenueFor(key: DataGuideKey, config: SiteConfig, overdue: boolean): RevenueView {
  if (overdue) return NO_REVENUE;
  const row = config.stateGuide[key];
  return {
    tier: row.revenueTier,
    stores: row.stores,
    recommendations: row.recommendations,
    recommendationContext: row.recommendations === "none" ? null : RECOMMENDATION_CONTEXT[key] ?? null,
    adsAllowed: row.revenueTier !== "none"
  };
}

function auxiliaryLineFor(data: TrackResponseData, key: DataGuideKey, config: SiteConfig): TrackingViewModel["auxiliaryLine"] {
  if (!OVERDUE_KEYS.has(key) || data.delivery.lookupUnavailable !== true) return null;
  return { text: config.resultCopy.carrierCutLine, action: retryAction(config, "text") };
}

/** '마지막 단계' of the inquiry copy: the chip of the state the status code implies ('통관 대기'). */
function stageLabel(data: TrackResponseData, config: SiteConfig): string {
  const row = config.stateGuide[codeGuideKey(data)];
  return row.chip ?? row.docTitle;
}

export function deriveSuccessView(request: LookupRequest, data: TrackResponseData, now: Date, config: SiteConfig): TrackingViewModel {
  const key = dataGuideKey(data, now, config);
  const row = config.stateGuide[key];
  const events = timedEvents(data);
  const last = latestEvent(events);
  const worryKey = worryDateKey(data, key, config);
  const overdue = OVERDUE_KEYS.has(key) && isOverdue(worryKey, now);
  const number = numberView(request.number);
  const carrier = carrierForData(data, request, key, config);
  const spine = spineFor(data, key, config);
  const eta = etaFor({ data, key, overdue, now, events, config });
  const values = copyValues(eta, worryKey, last, carrier.name ?? config.resultCopy.carrierUnknown, config);
  const title = fillCopy(overdue && row.overdueTitle !== null ? row.overdueTitle : row.title, values);
  const nextAction = nextActionForData({ data, key, overdue, carrier, worryKey, events, values, config });
  const hasCopyAction = [nextAction.primary, ...nextAction.secondary].some((item) => item?.kind === "copyAndTalk" || item?.kind === "copyInquiry");
  const chipBase = overdue ? config.resultCopy.overdueChip : row.chip;
  return {
    guideKey: key,
    mode: "settled",
    tone: overdue ? "attention" : row.tone,
    overdue,
    number,
    carrier,
    chip: chipBase === null ? null : spine.positionLabel === null ? chipBase : `${chipBase} · ${spine.positionLabel}`,
    title,
    reason: row.reason === null ? null : fillCopy(row.reason, values),
    notice: noticeFor(config, now, key),
    spine,
    eta,
    nextAction,
    lastEvent: lastEventFor(last, config),
    history: historyFor(events, config),
    ctaState: ctaStateFor(key),
    inquiryLevel: overdue ? "primary" : row.inquiryLevel,
    revenue: revenueFor(key, config, overdue),
    retry: null,
    auxiliaryLine: auxiliaryLineFor(data, key, config),
    help: helpFor(config, key),
    inquiryCopy: hasCopyAction
      ? buildInquiryCopy({ kind: "status", number, stage: stageLabel(data, config), lastEventAt: last?.at ?? null })
      : null,
    returnLink: buildReturnLink(number.raw, carrier.code),
    documentTitle: documentTitleFor(row.docTitle),
    liveMessage: liveMessageFor(title, eta)
  };
}
