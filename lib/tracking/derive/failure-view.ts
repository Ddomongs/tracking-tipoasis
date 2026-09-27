import type { SiteConfig } from "@/lib/config/types";
import { buildReturnLink } from "@/lib/site";
import { requestCarrierView } from "@/lib/tracking/carriers";
import { guideKeyForFailure } from "@/lib/tracking/classify-failure";
import { copyAndTalkAction, fixNumberAction, retryAction, talkAction } from "@/lib/tracking/derive/actions";
import { historyFor } from "@/lib/tracking/derive/history";
import { NO_REVENUE, documentTitleFor, helpFor, noticeFor, numberView } from "@/lib/tracking/derive/shared";
import { EMPTY_SPINE } from "@/lib/tracking/derive/spine";
import { buildInquiryCopy } from "@/lib/tracking/inquiry-copy";
import { fillCopy } from "@/lib/tracking/template";
import type { ActionView, LookupOutcome, PrimaryActionKind, TrackingViewModel } from "@/lib/tracking/types";

type FailureOutcome = Extract<LookupOutcome, { kind: "failure" }>;

function recoveryAction(kind: PrimaryActionKind, config: SiteConfig): ActionView | null {
  switch (kind) {
    case "fixNumber":
      return fixNumberAction(config, "primary");
    case "retry":
      return retryAction(config, "primary");
    case "copyAndTalk":
      return copyAndTalkAction(config);
    default:
      return null;
  }
}

export function deriveFailureView(outcome: FailureOutcome, now: Date, config: SiteConfig): TrackingViewModel {
  const key = guideKeyForFailure(outcome.cause);
  const row = config.stateGuide[key];
  const number = numberView(outcome.request.number);
  const carrier = requestCarrierView(outcome.request, config.resultCopy.carrierUnknown);
  const values = { carrier: carrier.name ?? config.resultCopy.carrierUnknown, staleDays: String(config.durations.staleDays) };
  const title = fillCopy(row.title, values);
  const primary = recoveryAction(row.primaryAction, config);
  const secondary = primary?.kind === "copyAndTalk" ? [retryAction(config, "secondary")] : [talkAction(config, "secondary")];
  return {
    guideKey: key,
    mode: "error",
    tone: row.tone,
    overdue: false,
    number,
    carrier,
    chip: row.chip,
    title,
    reason: row.reason === null ? null : fillCopy(row.reason, values),
    notice: noticeFor(config, now, key),
    spine: EMPTY_SPINE,
    eta: { kind: "none" },
    nextAction: {
      heading: row.ctaHeading, sentence: fillCopy(row.nextAction, values), primary, secondary,
      worry: null, stores: null, carrierChoices: null, note: null
    },
    lastEvent: null,
    history: historyFor([], config),
    ctaState: "error",
    inquiryLevel: row.inquiryLevel,
    revenue: NO_REVENUE,
    retry: { cooldownSeconds: null, autoRetryWhenOnline: false, escalated: false },
    auxiliaryLine: null,
    help: helpFor(config, key),
    inquiryCopy: primary?.kind === "copyAndTalk" ? buildInquiryCopy({ kind: "screenError", number, now }) : null,
    returnLink: buildReturnLink(number.raw, outcome.request.carrier),
    documentTitle: documentTitleFor(row.docTitle),
    liveMessage: title
  };
}
