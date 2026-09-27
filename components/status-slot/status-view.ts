import { resultCopy, siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { fillSlots } from "@/lib/tracking/template";
import type { ActionView, EtaView, GuideKey, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";

// Transitional (S04; deleted by S07 with components/status-slot/). The customer page renders exactly deriveStatusView(); the internal
// CS helper keeps deriveTrackingView() so CS replies use the spec copy.

/** Roadmap §4 ledger values this slot needs. The S04 plan's Task 9 (approval 3) and Task 10 (approval 2) flip them. */
export interface StatusSlotApprovals {
  /** 승인 2: copy-bound E2E assertions may change. Until then the tested result sentences stay as they were. */
  readonly approval2: boolean;
  /** 승인 3: the recovery action leads error screens. Until then 톡톡 is the filled primary and [번호 수정]/[다시 조회] are secondary. */
  readonly approval3: boolean;
}

export const STATUS_SLOT_APPROVALS: StatusSlotApprovals = { approval2: true, approval3: true };

/** The pre-renewal result wording that tests/tracking.spec.ts and tests/privacy.spec.ts assert (roadmap §4, "S04 fallback"). */
export const LEGACY_RESULT_COPY = {
  etaLabel: "배송 완료 예상일",
  customsEstimateCaption: "통관완료 예상일 {date}",
  customsDoneCaption: "통관 완료일 {date}",
  staleEtaText: "배송 이력 확인 필요",
  customsWaitingTitle: "통관대기",
  pickedUpReason: "{carrier} 기사님이 상품을 인수해 배송 출발을 준비하고 있습니다.",
  sentences: {
    customsWaiting: "정상 통관 대기 상태입니다. 지금은 별도 문의 없이 조금만 기다려 주세요.",
    pickedUp: "픽업이 완료됐습니다. 배송 이동이 시작되면 현재 위치가 업데이트됩니다.",
    inTransit: "배송 중입니다. 문자로 안내된 배송 예정 시간을 확인해 주세요.",
    delivered: "배송이 완료됐습니다. 상품 상태를 확인해 주세요.",
    stale: "마지막 처리 이후 오래 지났습니다. 문의 내용을 복사해 톡톡으로 보내 주세요."
  }
} as const;

type LegacySentenceKey = keyof typeof LEGACY_RESULT_COPY.sentences;

const RECOVERY_KINDS: ReadonlySet<ActionView["kind"]> = new Set<ActionView["kind"]>(["fixNumber", "retry"]);

function isLegacySentenceKey(key: GuideKey): key is LegacySentenceKey {
  return key in LEGACY_RESULT_COPY.sentences;
}

/** '통관 완료 예상 ' from '통관 완료 예상 {date}': the part of a caption template before the date. */
function captionPrefix(template: string): string {
  return template.split("{date}")[0] ?? template;
}

function legacyCaption(caption: string | null): string | null {
  if (caption === null) return null;
  const estimate = captionPrefix(resultCopy.customsEstimateCaption);
  const done = captionPrefix(resultCopy.customsDoneCaption);
  if (caption.startsWith(estimate)) return fillSlots(LEGACY_RESULT_COPY.customsEstimateCaption, { date: caption.slice(estimate.length) });
  if (caption.startsWith(done)) return fillSlots(LEGACY_RESULT_COPY.customsDoneCaption, { date: caption.slice(done.length) });
  return caption;
}

function legacyEta(eta: EtaView, key: GuideKey): EtaView {
  switch (eta.kind) {
    case "date":
    case "holidayAffected":
      return { ...eta, label: LEGACY_RESULT_COPY.etaLabel, caption: legacyCaption(eta.caption) };
    case "today":
      return { ...eta, caption: legacyCaption(eta.caption) }; // '오늘 예상' was the pre-renewal badge too
    case "unknown":
      return { ...eta, label: LEGACY_RESULT_COPY.etaLabel };
    case "withheld":
      return key === "stale" ? { ...eta, label: LEGACY_RESULT_COPY.etaLabel, text: LEGACY_RESULT_COPY.staleEtaText } : eta;
    case "none":
    case "pendingInfo":
    case "overdue":
    case "deliveredOn":
      return eta;
  }
}

/** Same sentence shape as deriveTrackingView's live message: the status title plus the ETA line. */
function liveMessageFor(title: string, eta: EtaView): string {
  switch (eta.kind) {
    case "none":
      return title;
    case "pendingInfo":
    case "withheld":
    case "unknown":
      return `${title} · ${eta.label} ${eta.text}`;
    default:
      return `${title} · ${eta.label} ${eta.date.label}`;
  }
}

function withLegacyCopy(view: TrackingViewModel): TrackingViewModel {
  if (view.mode !== "settled" || view.overdue) return view;
  const key = view.guideKey;
  const carrier = view.carrier.name ?? resultCopy.carrierUnknown;
  const title = key === "customsWaiting" ? LEGACY_RESULT_COPY.customsWaitingTitle : view.title;
  const reason = key === "pickedUp" ? fillSlots(LEGACY_RESULT_COPY.pickedUpReason, { carrier }) : view.reason;
  const sentence = isLegacySentenceKey(key) ? LEGACY_RESULT_COPY.sentences[key] : view.nextAction.sentence;
  const eta = legacyEta(view.eta, key);
  const liveMessage = title === view.title && eta === view.eta ? view.liveMessage : liveMessageFor(title, eta);
  return { ...view, title, reason, eta, liveMessage, nextAction: { ...view.nextAction, sentence } };
}

/** Approval-3 fallback (spec §16 item 3 "거절하면"): 톡톡 becomes the filled primary; the recovery action moves to the secondaries. */
function withTalkFirst(view: TrackingViewModel): TrackingViewModel {
  const { primary, secondary } = view.nextAction;
  if (view.mode !== "error" || primary === null || !RECOVERY_KINDS.has(primary.kind)) return view;
  const talk = secondary.find((action) => action.kind === "talk");
  if (talk === undefined) return view;
  return {
    ...view,
    nextAction: {
      ...view.nextAction,
      primary: { ...talk, weight: "primary" },
      secondary: [{ ...primary, weight: "secondary" }, ...secondary.filter((action) => action !== talk)]
    }
  };
}

export function applyApprovalFallbacks(view: TrackingViewModel, approvals: StatusSlotApprovals): TrackingViewModel {
  const talkFirst = approvals.approval3 ? view : withTalkFirst(view);
  return approvals.approval2 ? talkFirst : withLegacyCopy(talkFirst);
}

/** The view the R2 page renders for a settled lookup; `now` is the client's clock when the result settled (spec §6 overdue). */
export function deriveStatusView(outcome: LookupOutcome, now: Date): TrackingViewModel {
  return applyApprovalFallbacks(deriveTrackingView(outcome, now, siteConfig), STATUS_SLOT_APPROVALS);
}
