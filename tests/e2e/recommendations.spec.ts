import { expect, test, type Page } from "@playwright/test";
import { disclosures, featuredProducts, resultCopy, siteConfig } from "@/config/site.config";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { RECOMMENDATION_PRESENTATION, recommendationsForView } from "@/lib/tracking/recommendations";
import type { LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { FIXTURE_NOW, mockTrack, trackData, type FixtureState } from "../fixtures/tracking-fixtures";

/** Spec §16 item 10 "거절하면" label (a literal of the spec, not config copy). */
const OPERATOR_PICKS_LABEL = "운영자 추천";
/** After every validity span of the shipped featuredProducts (they end 2027-03-31T23:59:59+09:00). */
const LATE_NOW = new Date("2027-04-01T09:00:00+09:00");
/** Price, discount, weekly or review claims — none may appear while approval 10 is pending. */
const PRICE_OR_CLAIM = /\d[\d,]*\s*원|\d+\s*%|이번 주|베스트|리뷰/;
const STATES: readonly FixtureState[] = [
  "pending", "customsWaiting", "customsCleared", "inTransit", "delivered", "stale", "lookupUnavailableCarrier", "ambiguous"
];

function viewOf(data: TrackResponseData, now: Date): TrackingViewModel {
  const outcome: LookupOutcome = {
    kind: "success",
    request: { number: data.trackingNumber, carrier: "AUTO", entry: "deepLink" },
    data
  };
  return deriveTrackingView(outcome, now, siteConfig);
}

async function openResult(page: Page, data: TrackResponseData, now: Date = FIXTURE_NOW): Promise<void> {
  await page.clock.setFixedTime(now);
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
  await mockTrack(page, data);
  await page.goto(`/${data.trackingNumber}`);
  await expect(page.locator("[data-result-view] h2")).toBeVisible();
}

/** The lazy list has had its chance to load: nothing is pending on the network any more. */
async function settled(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

async function precedes(page: Page, first: string, second: string): Promise<boolean> {
  return page.evaluate(
    ([a, b]) => {
      const x = document.querySelector(a);
      const y = document.querySelector(b);
      return x !== null && y !== null && (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    },
    [first, second] as const
  );
}

test.describe("'운영자 추천' dialog (S08, approval-10 fallback)", () => {
  test.skip(RECOMMENDATION_PRESENTATION !== "dialog", "approval 10 granted: the inline list replaced the dialog (Task 10)");

  test("pending: '운영자 추천' follows 처리 내역 and opens a dialog of the operator's picks — disclosure first, no price or discount", async ({ page }) => {
    const data = trackData("pending");
    const expected = recommendationsForView(viewOf(data, FIXTURE_NOW).revenue, featuredProducts, FIXTURE_NOW, RECOMMENDATION_PRESENTATION);
    expect(expected.length, "the shipped config recommends something for pending").toBeGreaterThan(0);
    await openResult(page, data);

    const block = page.locator('[data-recommended-products="pending"]');
    await expect(block.getByRole("heading", { level: 2, name: OPERATOR_PICKS_LABEL })).toBeVisible();
    expect(await precedes(page, "[data-history], [data-history-empty]", "[data-recommended-products]")).toBe(true);

    await block.getByRole("button", { name: resultCopy.recommendationsOpen }).click();
    const dialog = page.getByRole("dialog", { name: OPERATOR_PICKS_LABEL });
    await expect(dialog).toBeVisible();
    const links = dialog.getByRole("link");
    await expect(links).toHaveCount(expected.length);
    for (const [index, { item }] of expected.entries()) {
      const link = links.nth(index);
      await expect(link).toHaveAttribute("href", item.href);
      await expect(link).toHaveAccessibleName(`${item.name} 새 창으로 열기`);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", item.isAffiliate ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer");
    }
    if (expected.some(({ item }) => item.isAffiliate)) {
      await expect(dialog.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
      expect(await precedes(page, "dialog [data-affiliate-disclosure]", 'dialog a[rel~="sponsored"]')).toBe(true);
    }
    await expect(dialog).not.toContainText(PRICE_OR_CLAIM);
  });

  test("no product link is in the page until the dialog opens; Escape and 닫기 close it and return focus", async ({ page }) => {
    const data = trackData("delivered");
    const expected = recommendationsForView(viewOf(data, FIXTURE_NOW).revenue, featuredProducts, FIXTURE_NOW, RECOMMENDATION_PRESENTATION);
    expect(expected.length).toBeGreaterThan(0);
    await openResult(page, data);

    const block = page.locator('[data-recommended-products="delivered"]');
    const trigger = block.getByRole("button", { name: resultCopy.recommendationsOpen });
    await expect(trigger).toBeVisible();
    await expect(block.locator("a")).toHaveCount(0);

    await trigger.click();
    const dialog = page.getByRole("dialog", { name: OPERATOR_PICKS_LABEL });
    await expect(dialog.getByRole("link")).toHaveCount(expected.length);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(block.locator("a")).toHaveCount(0);

    await trigger.click();
    await dialog.getByRole("button", { name: resultCopy.recommendationsClose }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("where recommendations appear (S08)", () => {
  for (const state of STATES) {
    test(`${state}: a block exactly when the view and the item contexts allow one`, async ({ page }) => {
      const data = trackData(state);
      const view = viewOf(data, FIXTURE_NOW);
      const expected = recommendationsForView(view.revenue, featuredProducts, FIXTURE_NOW, RECOMMENDATION_PRESENTATION);
      await openResult(page, data);
      if (expected.length > 0 && view.revenue.recommendationContext !== null) {
        const block = page.locator(`[data-recommendation-slot] [data-recommended-products="${view.revenue.recommendationContext}"]`);
        await expect(block).toHaveCount(1);
      } else {
        await settled(page);
        await expect(page.locator("[data-recommended-products]")).toHaveCount(0);
      }
    });
  }

  test("after every validity span has ended, a result shows no recommendation block", async ({ page }) => {
    const data = trackData("delivered");
    const view = viewOf(data, LATE_NOW);
    expect(view.revenue.recommendations).not.toBe("none");
    expect(recommendationsForView(view.revenue, featuredProducts, LATE_NOW, RECOMMENDATION_PRESENTATION)).toEqual([]);
    await openResult(page, data, LATE_NOW);
    await settled(page);
    await expect(page.locator("[data-recommended-products]")).toHaveCount(0);
  });
});
