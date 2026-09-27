import type { GuideRow, SiteConfig } from "@/lib/config/types";
import { buildReturnLink } from "@/lib/site";
import { requestCarrierView } from "@/lib/tracking/carriers";
import { guideKeyForFailure } from "@/lib/tracking/classify-failure";
import {
  carrierOfficialAction, copyAndTalkAction, fixNumberAction, retryAction, returnLinkAction, talkAction
} from "@/lib/tracking/derive/actions";
import { historyFor } from "@/lib/tracking/derive/history";
import { NO_REVENUE, documentTitleFor, helpFor, noticeFor, numberView } from "@/lib/tracking/derive/shared";
import { EMPTY_SPINE } from "@/lib/tracking/derive/spine";
import { buildInquiryCopy } from "@/lib/tracking/inquiry-copy";
import { fillCopy, fillSlots } from "@/lib/tracking/template";
import { ERROR_GUIDE_KEYS } from "@/lib/tracking/types";
import type { ActionView, CarrierView, GuideKey, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";

type FailureOutcome = Extract<LookupOutcome, { kind: "failure" }>;
type ErrorKey = (typeof ERROR_GUIDE_KEYS)[number];

/** Two failures for the same number in a row make 톡톡 the filled primary (spec §5). */
const ESCALATE_AFTER_FAILURES = 2;
const ERROR_KEYS: ReadonlySet<GuideKey> = new Set<GuideKey>(ERROR_GUIDE_KEYS);

/** What the customer can do alone when the row does not name fixNumber or retry itself. */
const NATURAL_RECOVERY: Readonly<Record<ErrorKey, "fixNumber" | "retry">> = {
  invalidNumber: "fixNumber", notFound: "fixNumber", temporaryDelay: "retry", offline: "retry", noResponse: "retry", serverError: "retry"
};

interface FailureContext {
  readonly key: ErrorKey;
  readonly row: GuideRow;
  readonly config: SiteConfig;
  readonly carrier: CarrierView;
  readonly escalated: boolean;
  readonly cooldownSeconds: number | null;
  readonly caveat: boolean;
}

function isErrorKey(key: GuideKey): key is ErrorKey {
  return ERROR_KEYS.has(key);
}

function recoveryAction(context: FailureContext, weight: "primary" | "secondary"): ActionView {
  const configured = context.row.primaryAction;
  const kind = configured === "fixNumber" || configured === "retry" ? configured : NATURAL_RECOVERY[context.key];
  return kind === "fixNumber" ? fixNumberAction(context.config, weight) : retryAction(context.config, weight, context.cooldownSeconds);
}

function extraSecondary(context: FailureContext): readonly ActionView[] {
  const { key, config, carrier, caveat } = context;
  switch (key) {
    case "notFound":
      return [caveat ? returnLinkAction(config, "text") : retryAction(config, "text")];
    case "temporaryDelay":
      return carrier.officialUrl === null || carrier.name === null
        ? []
        : [carrierOfficialAction(config, carrier.name, carrier.officialUrl, "text", false)];
    case "noResponse":
      // The recovery action the row did not make primary (spec §7: retry first; §16 item 3 proposal: fixNumber first).
      return [context.row.primaryAction === "fixNumber" ? retryAction(config, "secondary") : fixNumberAction(config, "secondary")];
    default:
      return [];
  }
}

/** 톡톡 is always the first link of the error CTA block; the recovery action leads unless 톡톡 is the filled primary. */
function failureActions(context: FailureContext): { readonly primary: ActionView | null; readonly secondary: readonly ActionView[] } {
  const { row, config, escalated } = context;
  if (escalated || row.primaryAction === "copyAndTalk") {
    return { primary: copyAndTalkAction(config), secondary: [recoveryAction(context, "secondary")] };
  }
  const primary = row.primaryAction === "none" ? null : recoveryAction(context, "primary");
  return { primary, secondary: [talkAction(config, "secondary"), ...extraSecondary(context)] };
}

export function deriveFailureView(outcome: FailureOutcome, now: Date, config: SiteConfig): TrackingViewModel {
  const key = guideKeyForFailure(outcome.cause);
  if (!isErrorKey(key)) throw new Error(`오류 상태가 아닙니다: ${key}`);
  const row = config.stateGuide[key];
  const copy = config.resultCopy;
  const number = numberView(outcome.request.number);
  const carrier = requestCarrierView(outcome.request, copy.carrierUnknown);
  const cooldownSeconds = outcome.cause === "rateLimited" ? config.lookup.rateLimitCooldownSeconds : null;
  const escalated = key !== "invalidNumber" && outcome.consecutiveFailures >= ESCALATE_AFTER_FAILURES;
  const caveat = key === "notFound" && config.lookup.notFoundServiceCaveat;
  const { primary, secondary } = failureActions({ key, row, config, carrier, escalated, cooldownSeconds, caveat });
  const values = { carrier: carrier.name ?? copy.carrierUnknown, staleDays: String(config.durations.staleDays) };
  const title = fillCopy(row.title, values);
  const reason = cooldownSeconds === null ? row.reason : fillSlots(copy.rateLimitedReason, { seconds: String(cooldownSeconds) });
  return {
    guideKey: key,
    mode: "error",
    tone: row.tone,
    overdue: false,
    number,
    carrier,
    chip: row.chip,
    title,
    reason: reason === null ? null : fillCopy(reason, values),
    notice: noticeFor(config, now, key),
    spine: EMPTY_SPINE,
    eta: { kind: "none" },
    nextAction: {
      heading: row.ctaHeading,
      sentence: fillCopy(row.nextAction, values),
      primary,
      secondary,
      worry: key === "notFound" && row.worry !== null
        ? { dateKey: null, text: fillCopy(row.worry, values), talk: talkAction(config, "text") }
        : null,
      stores: null,
      carrierChoices: null,
      note: null
    },
    lastEvent: null,
    history: historyFor([], config),
    ctaState: "error",
    inquiryLevel: escalated ? "primary" : row.inquiryLevel,
    revenue: NO_REVENUE,
    retry: { cooldownSeconds, autoRetryWhenOnline: outcome.cause === "offline", escalated },
    auxiliaryLine: caveat ? { text: copy.notFoundCaveat, action: retryAction(config, "text") } : null,
    help: helpFor(config, key),
    inquiryCopy: primary?.kind === "copyAndTalk" ? buildInquiryCopy({ kind: "screenError", number, now }) : null,
    returnLink: buildReturnLink(number.raw, outcome.request.carrier),
    documentTitle: documentTitleFor(row.docTitle),
    liveMessage: title
  };
}
