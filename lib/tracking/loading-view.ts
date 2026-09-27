import type { LoadingConfig } from "@/lib/config/types";
import { requestCarrierView } from "@/lib/tracking/carriers";
import { pickNotice, toNoticeView } from "@/lib/tracking/notices";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import { fillSlots } from "@/lib/tracking/template";
import type { ActionView, LoadingStage, LoadingViewModel, LookupRequest } from "@/lib/tracking/types";

// Client-safe (initial bundle through useLookup): no zod, no lib/delivery-carriers.ts, no derive helpers.

const MS_PER_SECOND = 1000;

export function loadingStageAt(elapsedMs: number, config: LoadingConfig): LoadingStage {
  const { skeletonDelayMs, stageMs } = config.lookup;
  if (elapsedMs < skeletonDelayMs) return "instant";
  if (elapsedMs < stageMs[0]) return "short";
  if (elapsedMs < stageMs[1]) return "long";
  return "veryLong";
}

/** Seconds shown from the very-long stage on: start, start + step, start + 2·step … (8, 13, 18 with the defaults). */
function elapsedSeconds(elapsedMs: number, config: LoadingConfig): number | null {
  const veryLongMs = config.lookup.stageMs[1];
  if (elapsedMs < veryLongMs) return null;
  const step = config.lookup.elapsedStepSeconds;
  return Math.ceil(veryLongMs / MS_PER_SECOND) + Math.floor((elapsedMs - veryLongMs) / (step * MS_PER_SECOND)) * step;
}

/** The next elapsed time at which deriveLoadingView returns a different model. */
export function nextLoadingChangeMs(elapsedMs: number, config: LoadingConfig): number {
  const { skeletonDelayMs, stageMs, spinnerStopMs, elapsedStepSeconds } = config.lookup;
  const upcoming = [skeletonDelayMs, stageMs[0], spinnerStopMs, stageMs[1]].filter((bound) => bound > elapsedMs);
  if (upcoming.length > 0) return Math.min(...upcoming);
  const stepMs = elapsedStepSeconds * MS_PER_SECOND;
  return stageMs[1] + (Math.floor((elapsedMs - stageMs[1]) / stepMs) + 1) * stepMs;
}

function extraFor(stage: LoadingStage, config: LoadingConfig): string | null {
  switch (stage) {
    case "long":
      return config.lookup.copy.longWait;
    case "veryLong":
      return config.lookup.copy.veryLongWait;
    default:
      return null;
  }
}

function announcementFor(stage: LoadingStage, config: LoadingConfig): string | null {
  switch (stage) {
    case "short":
      return config.lookup.copy.started;
    case "veryLong":
      return config.lookup.copy.veryLongWait;
    default:
      return null;
  }
}

function cancelAction(label: string): ActionView {
  return { kind: "cancel", label, weight: "secondary", href: null, external: false, cooldownSeconds: null };
}

function officialFirstAction(label: string, href: string): ActionView {
  return { kind: "carrierOfficial", label, weight: "text", href, external: true, cooldownSeconds: null };
}

export function deriveLoadingView(
  input: { readonly request: LookupRequest; readonly elapsedMs: number; readonly reducedMotion: boolean; readonly now: Date },
  config: LoadingConfig
): LoadingViewModel {
  const { request, elapsedMs, reducedMotion, now } = input;
  const copy = config.lookup.copy;
  const stage = loadingStageAt(elapsedMs, config);
  const carrier = requestCarrierView(request, copy.carrierAuto);
  const seconds = elapsedSeconds(elapsedMs, config);
  const outage = pickNotice(config.notices, now, { kind: "result", guideKey: "loading" });
  const waitingLong = stage === "long" || stage === "veryLong";
  return {
    stage,
    number: { raw: request.number, grouped: groupTrackingNumber(request.number) },
    carrier,
    title: copy.title,
    body: copy.body,
    extra: extraFor(stage, config),
    elapsedText: seconds === null ? null : fillSlots(copy.elapsed, { seconds: String(seconds) }),
    cancel: waitingLong ? cancelAction(copy.cancel) : null,
    carrierOfficial: stage === "veryLong" && carrier.officialUrl !== null ? officialFirstAction(copy.carrierOfficialFirst, carrier.officialUrl) : null,
    spinnerActive: !reducedMotion && elapsedMs < config.lookup.spinnerStopMs,
    announcement: announcementFor(stage, config),
    submitLabel: copy.submitting,
    outageNotice: outage === null ? null : toNoticeView(outage)
  };
}
