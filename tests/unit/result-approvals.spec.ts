import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { RESULT_APPROVALS, applyResultApprovals, deriveResultView, type ResultApprovals } from "@/components/result/approvals";
import { loadResultModule } from "@/components/result/load-result-module";
import { siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import { OCTOBER_NOW, customsWaitingData, failure, inTransitData, success } from "../fixtures/derive-scenarios";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const PENDING: ResultApprovals = { approval3: false };
const APPROVED: ResultApprovals = { approval3: true };

const base = (outcome: LookupOutcome, now: Date = FIXTURE_NOW): TrackingViewModel => deriveTrackingView(outcome, now, siteConfig);

test("RESULT_APPROVALS follows approval 3 in the roadmap ledger", () => {
  const ledger = readFileSync(path.join(process.cwd(), "docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md"), "utf8");
  // The status cell may carry a date after the word ("approved 2026-09-27"), as in S04's ledger tests.
  const status = /^\| 3 \| [^|]+\| (\w+)[^|]*\|/m.exec(ledger)?.[1];
  expect(status, "approval 3 row not found in roadmap §4").toBeTruthy();
  expect(RESULT_APPROVALS.approval3).toBe(status === "approved");
});

test("with approval 3 the view passes through untouched", () => {
  for (const outcome of [success(customsWaitingData()), failure("notFound"), failure("clientTimeout")]) {
    const view = base(outcome);
    expect(applyResultApprovals(view, APPROVED)).toBe(view);
  }
});

test("deriveResultView is deriveTrackingView plus the ledger's approval-3 decision, and the lazy module exports it", async () => {
  const outcome = failure("notFound");
  expect(deriveResultView(outcome, FIXTURE_NOW)).toEqual(applyResultApprovals(base(outcome), RESULT_APPROVALS));
  expect((await loadResultModule()).deriveResultView).toBe(deriveResultView);
});

test.describe("approval 3 pending: 톡톡 is the filled primary on error screens", () => {
  test("NOT_FOUND: 톡톡 leads and [번호 수정] becomes a secondary", () => {
    const view = applyResultApprovals(base(failure("notFound")), PENDING);
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
    const view = applyResultApprovals(base(failure("clientTimeout")), PENDING);
    expect(view.nextAction.primary?.kind).toBe("talk");
    expect(view.nextAction.secondary.map((action) => [action.kind, action.weight])).toEqual([
      ["retry", "secondary"],
      ["fixNumber", "secondary"]
    ]);
  });

  test("429 keeps the countdown on the demoted [다시 조회]", () => {
    const view = applyResultApprovals(base(failure("rateLimited")), PENDING);
    expect(view.nextAction.secondary[0]).toMatchObject({
      kind: "retry",
      weight: "secondary",
      cooldownSeconds: siteConfig.lookup.rateLimitCooldownSeconds
    });
  });

  test("server errors and a second failure in a row keep copy-and-talk", () => {
    for (const outcome of [failure("serverError"), failure("network", { consecutiveFailures: 2 })]) {
      const view = base(outcome);
      expect(applyResultApprovals(view, PENDING)).toBe(view);
    }
  });

  test("result views are never touched by the approval-3 fallback", () => {
    const view = base(success(inTransitData()), OCTOBER_NOW);
    expect(applyResultApprovals(view, PENDING)).toBe(view);
  });
});
