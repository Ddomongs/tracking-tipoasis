import { expect, test, type Page } from "@playwright/test";
import { siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { FailureCause, LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import { customsWaitingData, pendingData, success } from "../fixtures/derive-scenarios";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";

/**
 * Component contracts of the result area through the internal harness (/internal/result-kit).
 * Every view model is derived here, in Node, with the shipped config — the page only renders it.
 */
test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

interface KitOptions {
  readonly frame?: "responsive" | "mobile";
  readonly readOnly?: boolean;
  readonly failureCause?: FailureCause;
  readonly withRecommendation?: boolean;
}

const at = (iso: string): Date => new Date(iso);

function viewFor(outcome: LookupOutcome, now: Date = FIXTURE_NOW): TrackingViewModel {
  return deriveTrackingView(outcome, now, siteConfig);
}

async function openKit(page: Page, width = 375, height = 812): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto("/internal/result-kit");
  await expect(page.locator('[data-result-kit="ready"]')).toBeAttached();
}

async function showView(page: Page, view: TrackingViewModel, options: KitOptions = {}): Promise<void> {
  await page.evaluate(
    ({ nextView, nextOptions }) => {
      const kit = window.__ttResultKit;
      if (kit === undefined) throw new Error("result kit is not ready");
      kit.show({ kind: "result", view: nextView, ...nextOptions });
    },
    { nextView: view, nextOptions: options }
  );
  await expect(page.locator("[data-result-view]")).toBeVisible();
}

test.describe("status card", () => {
  test("customs waiting: chip, focusable h2, reason, one current station, the in-card notice and the ETA as the largest text", async ({ page }) => {
    const view = viewFor(success(customsWaitingData()));
    await openKit(page);
    await showView(page, view);
    const root = page.locator("[data-result-view]");
    await expect(root).toHaveAttribute("data-result-view", "settled");
    await expect(root).toHaveAttribute("data-ad-exclude", "true");
    const card = root.locator("[data-guide-key]");
    await expect(card).toHaveAttribute("data-guide-key", "customsWaiting");
    await expect(card).toHaveAttribute("data-overdue", "false");
    await expect(card).toHaveAttribute("data-tone", view.tone);
    const field = card.locator('[data-slot="status-head"]');
    await expect(field).toHaveAttribute("data-tone", view.tone);
    await expect(field.locator("[data-status-chip]")).toHaveText(view.chip ?? "");
    const title = card.getByRole("heading", { level: 2 });
    await expect(title).toHaveText(view.title);
    await expect(title).toHaveAttribute("tabindex", "-1");
    expect(await title.getAttribute("role")).toBeNull();
    await expect(field.getByText(view.reason ?? "", { exact: true })).toBeVisible();
    await expect(field.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(field.locator("[data-spine-current]")).toHaveAttribute("data-spine-current", "customs");
    await expect(field.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", view.eta.kind);
    expect(view.notice).not.toBeNull();
    await expect(field.locator('[data-notice-variant="inline"]')).toContainText(view.notice?.body ?? "");
    const sizes = await card.evaluate((element) => {
      const visual = element.querySelector("[data-eta-visual]");
      const textSizes = Array.from(element.querySelectorAll("*"))
        .filter((node) =>
          Array.from(node.childNodes).some((child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? "").trim() !== "")
        )
        .filter((node) => node.closest(".sr-only") === null)
        .map((node) => Number.parseFloat(getComputedStyle(node).fontSize));
      return { eta: visual === null ? 0 : Number.parseFloat(getComputedStyle(visual).fontSize), max: Math.max(...textSizes) };
    });
    expect(sizes.eta).toBeGreaterThanOrEqual(32);
    expect(sizes.max).toBe(sizes.eta);
  });

  test("overdue keeps the station, switches to the attention tone and marks data-overdue", async ({ page }) => {
    const view = viewFor(success(customsWaitingData()), at("2026-09-29T09:00:00+09:00"));
    expect(view.overdue).toBe(true);
    await openKit(page);
    await showView(page, view);
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card).toHaveAttribute("data-overdue", "true");
    await expect(card).toHaveAttribute("data-tone", "attention");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(view.title);
    await expect(card.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", "overdue");
  });

  test("pending: no station marker, '위치 확인 전' and the pending ETA text", async ({ page }) => {
    const view = viewFor(success(pendingData()));
    await openKit(page);
    await showView(page, view);
    const card = page.locator("[data-result-view] [data-guide-key]");
    await expect(card).toHaveAttribute("data-guide-key", "pending");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText("통관 정보 등록 전");
    await expect(card.locator('[aria-current="step"]')).toHaveCount(0);
    await expect(card.locator('[data-spine-part="unknown"]')).toHaveText("위치 확인 전");
    await expect(card.locator('[data-slot="eta"]')).toHaveAttribute("data-eta-kind", "pendingInfo");
    await expect(card.locator("[data-eta-text]")).toHaveText("정보 등록 후 안내");
  });
});
