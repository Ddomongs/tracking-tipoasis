import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { deriveStatusView } from "@/components/status-slot/status-view";
import { channels, disclosures } from "@/config/site.config";
import { PROBLEM_GUIDE_KEYS } from "@/lib/tracking/types";
import type { ActionView, FailureCause, GuideKey, StoreLinkView } from "@/lib/tracking/types";
import { FAKE, FIXTURE_NOW, GAP3_06_VARIANTS, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import type { FailureFixture } from "../fixtures/tracking-fixtures";
import { blockThirdParty, lookUp, manualRequest, statusSlot } from "../support/status-slot";

const PROBLEM_KEYS: ReadonlySet<GuideKey> = new Set<GuideKey>(PROBLEM_GUIDE_KEYS);
const STORE_HREFS: readonly string[] = [...new Set([...Object.values(channels.naver.urls), ...Object.values(channels.coupang.urls)])];
/** Store links anywhere: the CTA's purchase choices and store lead, the showcase, the popup, and the header's '#storefront' anchor. */
const STORE_LINKS = STORE_HREFS.map((href) => `a[href="${href}"]`).join(", ");
const PAGE_STORE_PLACEMENTS = `${STORE_LINKS}, a[href="#storefront"]`;
/** The five API error codes GAP3-06 counts next to the 12 data variants. */
const ERROR_FIXTURES: ReadonlyArray<readonly [FailureFixture, FailureCause]> = [
  ["invalid400", "invalidNumber"],
  ["upstreamTimeout504", "upstreamTimeout"],
  ["notFound404", "notFound"],
  ["serverError500", "serverError"],
  ["rateLimited429", "rateLimited"]
];

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

test.beforeEach(async ({ page }) => {
  await blockThirdParty(page);
  await page.clock.setFixedTime(FIXTURE_NOW);
});

test("the idle page keeps its store shortcuts", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.locator("[data-storefront-showcase]")).toBeVisible();
  await expect(page.locator(PAGE_STORE_PLACEMENTS).first()).toBeAttached();
});

for (const state of GAP3_06_VARIANTS) {
  test(`${state}: status, 지금 할 일, stores and recommendations tell the same story`, async ({ page }) => {
    const data = trackData(state);
    const view = deriveStatusView({ kind: "success", request: manualRequest(data.trackingNumber), data }, FIXTURE_NOW);
    await mockTrack(page, data);
    await page.goto("/");
    await lookUp(page, data.trackingNumber);

    const slot = statusSlot(page);
    await expect(slot.locator("[data-guide-key]")).toHaveAttribute("data-guide-key", view.guideKey);
    const cta = slot.locator("[data-cta-state]");
    await expect(cta).toHaveAttribute("data-cta-state", view.ctaState);
    if (view.nextAction.heading !== null) await expect(cta.getByRole("heading", { level: 3 })).toHaveText(view.nextAction.heading);
    await expect(cta.getByText(view.nextAction.sentence, { exact: true })).toBeVisible();

    const stores = view.nextAction.stores;
    const problem = PROBLEM_KEYS.has(view.guideKey) || view.overdue;
    if (problem || view.guideKey === "inTransit" || stores === null) {
      await expect(page.locator(PAGE_STORE_PLACEMENTS)).toHaveCount(0);
      await expect(page.locator('a[rel~="sponsored"]')).toHaveCount(0);
    } else {
      await expect(cta.locator(STORE_LINKS)).toHaveCount(stores.links.length);
      await expect(page.locator(PAGE_STORE_PLACEMENTS)).toHaveCount(stores.links.length);
      await expect(cta.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
      expect(await precedes(page, "#tracking-panel [data-affiliate-disclosure]", '#tracking-panel [data-cta-state] a[rel~="sponsored"]')).toBe(true);
    }
    if (view.guideKey === "delivered") {
      const firstTwo = await cta.getByRole("link").evaluateAll((links) => links.slice(0, 2).map((link) => link.getAttribute("href")));
      expect(firstTwo).toEqual((stores?.links ?? []).map((link) => link.href));
    }
    if (view.guideKey === "stale") {
      await expect(slot.locator("[data-eta-kind]")).toHaveAttribute("data-eta-kind", "withheld");
      await expect(slot.getByText("오늘 예상")).toHaveCount(0);
    }

    const weighted: ReadonlyArray<ActionView | StoreLinkView | null> = [view.nextAction.primary, ...(stores?.links ?? [])];
    const filled = weighted.filter((item) => item !== null && item.weight === "primary").length;
    await expect(slot.locator('[data-slot="button"][data-variant="primary"]')).toHaveCount(filled);
    await expect(page.locator("[data-recommended-products]")).toHaveCount(view.revenue.recommendations === "inline" ? 1 : 0);
  });
}

for (const [fixture, cause] of ERROR_FIXTURES) {
  test(`${fixture}: no store, showcase, popup, recommendation or sponsored link anywhere on the page`, async ({ page }) => {
    const view = deriveStatusView({ kind: "failure", request: manualRequest(FAKE.domestic), cause, consecutiveFailures: 1 }, FIXTURE_NOW);
    expect(view.revenue).toMatchObject({ stores: "none", recommendations: "none", adsAllowed: false });
    await mockTrack(page, fixture);
    await page.goto("/");
    await lookUp(page, FAKE.domestic);
    // S06: a server INVALID answer shows its error block under the form, outside the slot (RULE-MAP S3).
    await expect(page.locator('[data-cta-state="error"]')).toBeVisible();
    await expect(page.locator(PAGE_STORE_PLACEMENTS)).toHaveCount(0);
    await expect(page.locator('a[rel~="sponsored"], [data-recommended-products], [data-storefront-showcase], [data-contact-popup]')).toHaveCount(0);
  });
}
