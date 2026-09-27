import { expect, test } from "@playwright/test";
import {
  LEGACY_RESULT_COPY,
  STATUS_SLOT_APPROVALS,
  applyApprovalFallbacks,
  deriveStatusView
} from "@/components/status-slot/status-view";
import { siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { EtaView, FailureCause, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import {
  OCTOBER_NOW,
  PICKUP_NOW,
  customsWaitingData,
  deliveredData,
  failure,
  inTransitData,
  pendingData,
  pickedUpData,
  staleData,
  success
} from "../fixtures/derive-scenarios";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const BOTH_PENDING = { approval2: false, approval3: false } as const;
const BOTH_APPROVED = { approval2: true, approval3: true } as const;
const ONLY_APPROVAL_2 = { approval2: true, approval3: false } as const;
const ONLY_APPROVAL_3 = { approval2: false, approval3: true } as const;

const base = (outcome: LookupOutcome, now: Date = FIXTURE_NOW): TrackingViewModel => deriveTrackingView(outcome, now, siteConfig);
const captionOf = (eta: EtaView): string | null =>
  eta.kind === "date" || eta.kind === "today" || eta.kind === "holidayAffected" ? eta.caption : null;

// The two ledger rows mirror roadmap §4; Task 10 (approval 2) and Task 9 (approval 3) flip them one at a time.
test("ledger: approval 2 is pending (roadmap §4)", () => {
  expect(STATUS_SLOT_APPROVALS.approval2).toBe(BOTH_PENDING.approval2);
});

test("ledger: approval 3 is approved (roadmap §4)", () => {
  expect(STATUS_SLOT_APPROVALS.approval3).not.toBe(BOTH_PENDING.approval3);
});

test("with both approvals the view passes through untouched", () => {
  for (const outcome of [success(customsWaitingData()), failure("notFound"), failure("clientTimeout")]) {
    const view = base(outcome);
    expect(applyApprovalFallbacks(view, BOTH_APPROVED)).toBe(view);
  }
});

test("deriveStatusView is deriveTrackingView plus the ledger's fallbacks", () => {
  const outcome = success(customsWaitingData());
  expect(deriveStatusView(outcome, FIXTURE_NOW)).toEqual(applyApprovalFallbacks(base(outcome), STATUS_SLOT_APPROVALS));
});

test.describe("approval 3 pending: 톡톡 is the filled primary on error screens", () => {
  test("NOT_FOUND: 톡톡 leads and [번호 수정] becomes a secondary", () => {
    const view = applyApprovalFallbacks(base(failure("notFound")), ONLY_APPROVAL_2);
    expect(view.nextAction.primary).toEqual({
      kind: "talk",
      label: siteConfig.channels.talk.labels.cta,
      weight: "primary",
      href: siteConfig.channels.talk.url,
      external: true,
      cooldownSeconds: null
    });
    const extra = siteConfig.lookup.notFoundServiceCaveat ? "copyReturnLink" : "retry";
    expect(view.nextAction.secondary.map((action) => [action.kind, action.weight])).toEqual([
      ["fixNumber", "secondary"],
      [extra, "text"]
    ]);
    expect(view.inquiryCopy).toBeNull();
  });

  test("client timeout: [다시 조회] and [번호 수정] are both secondary", () => {
    const view = applyApprovalFallbacks(base(failure("clientTimeout")), ONLY_APPROVAL_2);
    expect(view.nextAction.primary?.kind).toBe("talk");
    expect(view.nextAction.secondary.map((action) => [action.kind, action.weight])).toEqual([
      ["retry", "secondary"],
      ["fixNumber", "secondary"]
    ]);
  });

  test("429 keeps the countdown on the demoted [다시 조회]", () => {
    const view = applyApprovalFallbacks(base(failure("rateLimited")), ONLY_APPROVAL_2);
    expect(view.nextAction.secondary[0]).toMatchObject({
      kind: "retry",
      weight: "secondary",
      cooldownSeconds: siteConfig.lookup.rateLimitCooldownSeconds
    });
  });

  test("server errors and a second failure in a row keep copy-and-talk", () => {
    for (const outcome of [failure("serverError"), failure("network", { consecutiveFailures: 2 })]) {
      const view = base(outcome);
      expect(applyApprovalFallbacks(view, ONLY_APPROVAL_2)).toBe(view);
    }
  });

  test("result views are never touched by the approval-3 fallback", () => {
    const view = base(success(inTransitData()), OCTOBER_NOW);
    expect(applyApprovalFallbacks(view, ONLY_APPROVAL_2)).toBe(view);
  });
});

test.describe("approval 2 pending: the tested result wording stays", () => {
  const legacy = (outcome: LookupOutcome, now: Date = FIXTURE_NOW): TrackingViewModel =>
    applyApprovalFallbacks(base(outcome, now), ONLY_APPROVAL_3);

  test("customs waiting: '통관대기', the pre-renewal sentence, the estimate label and caption", () => {
    const original = base(success(customsWaitingData()));
    const view = legacy(success(customsWaitingData()));
    expect(view.title).toBe(LEGACY_RESULT_COPY.customsWaitingTitle);
    expect(view.nextAction.sentence).toBe(LEGACY_RESULT_COPY.sentences.customsWaiting);
    if (view.eta.kind !== "date" && view.eta.kind !== "holidayAffected") throw new Error(`unexpected ETA kind ${view.eta.kind}`);
    expect(view.eta.label).toBe(LEGACY_RESULT_COPY.etaLabel);
    expect(captionOf(view.eta)).toMatch(/^통관완료 예상일 /);
    expect(view.liveMessage).toBe(`${LEGACY_RESULT_COPY.customsWaitingTitle} · ${LEGACY_RESULT_COPY.etaLabel} ${view.eta.date.label}`);
    expect([view.guideKey, view.ctaState, view.tone, view.revenue, view.nextAction.worry]).toEqual([
      original.guideKey,
      original.ctaState,
      original.tone,
      original.revenue,
      original.nextAction.worry
    ]);
  });

  test("picked up: the pre-renewal reason with the carrier and the pickup sentence", () => {
    const view = legacy(success(pickedUpData()), PICKUP_NOW);
    expect(view.title).toBe("CJ대한통운 기사님 픽업 완료!");
    expect(view.reason).toBe("CJ대한통운 기사님이 상품을 인수해 배송 출발을 준비하고 있습니다.");
    expect(view.nextAction.sentence).toBe(LEGACY_RESULT_COPY.sentences.pickedUp);
    expect(captionOf(view.eta) ?? "").toMatch(/^통관 완료일 /);
  });

  test("in transit and delivered: the pre-renewal next-action sentences", () => {
    const transit = legacy(success(inTransitData()), OCTOBER_NOW);
    expect(transit.nextAction.sentence).toBe(LEGACY_RESULT_COPY.sentences.inTransit);
    expect(transit.eta.kind === "today" ? transit.eta.label : transit.eta.kind).toBe(siteConfig.resultCopy.etaTodayLabel);
    const delivered = legacy(success(deliveredData()));
    expect(delivered.nextAction.sentence).toBe(LEGACY_RESULT_COPY.sentences.delivered);
    expect(delivered.eta).toEqual(base(success(deliveredData())).eta);
  });

  test("stale: the verification wording instead of an estimate", () => {
    const view = legacy(success(staleData()));
    expect(view.guideKey).toBe("stale");
    expect(view.eta).toEqual({ kind: "withheld", label: LEGACY_RESULT_COPY.etaLabel, text: LEGACY_RESULT_COPY.staleEtaText });
    expect(view.nextAction.sentence).toContain("마지막 처리 이후 오래 지났습니다");
    expect(view.nextAction.primary?.kind).toBe("copyAndTalk");
  });

  test("pending, overdue and error views keep their own copy", () => {
    const rows: ReadonlyArray<readonly [LookupOutcome, Date]> = [
      [success(pendingData()), FIXTURE_NOW],
      [success(customsWaitingData()), new Date("2026-09-29T00:00:00+09:00")],
      [failure("notFound"), FIXTURE_NOW]
    ];
    for (const [outcome, now] of rows) {
      const view = base(outcome, now);
      expect(applyApprovalFallbacks(view, ONLY_APPROVAL_3)).toEqual(view);
    }
  });
});

const ALL_CAUSES: readonly FailureCause[] = [
  "invalidNumber",
  "notFound",
  "rateLimited",
  "upstreamTimeout",
  "badGateway",
  "network",
  "offline",
  "clientTimeout",
  "serverError",
  "contractViolation"
];

test("approval 3 granted: the page's error views are deriveTrackingView's own, recovery action first", () => {
  for (const cause of ALL_CAUSES) {
    for (const consecutiveFailures of [1, 2]) {
      const outcome = failure(cause, { consecutiveFailures });
      expect(deriveStatusView(outcome, FIXTURE_NOW), `${cause} × ${consecutiveFailures}`).toEqual(base(outcome));
    }
  }
});
