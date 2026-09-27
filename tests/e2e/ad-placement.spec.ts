import { expect, test, type Locator, type Page } from "@playwright/test";
import { channels, disclosures, lookup, resultCopy } from "@/config/site.config";
import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";

async function blockThirdParty(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

/** True when `first` comes before `second` in document order. */
async function isBefore(first: Locator, second: Locator): Promise<boolean> {
  const other = await second.elementHandle();
  if (other === null) return false;
  return first.evaluate((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0, other);
}

test.beforeEach(async ({ page }) => {
  await blockThirdParty(page);
  await page.clock.setFixedTime(FIXTURE_NOW);
});

test.describe("home store showcase (S08)", () => {
  test("below '보통 이렇게 걸려요': a heading, then the definitive disclosure, then the two store links", async ({ page }) => {
    await page.goto("/");
    const showcase = page.locator("[data-store-showcase]");
    await expect(showcase).toHaveCount(1);
    await expect(showcase.getByRole("heading", { level: 2, name: resultCopy.showcaseTitle })).toBeVisible();
    const typical = page.locator("details", { has: page.locator("summary", { hasText: lookup.copy.typicalSummary }) });
    expect(await isBefore(typical, showcase)).toBe(true);

    const group = showcase.locator('[data-affiliate-group="showcase"]');
    await expect(group.locator("p, a").first()).toHaveAttribute("data-affiliate-disclosure", "coupang");
    await expect(group.locator("[data-affiliate-disclosure]")).toHaveText(disclosures.coupang);
    await expect(group.getByRole("link")).toHaveCount(2);
  });

  test("each store link opens its showcase link in a new tab, and only the affiliate one is sponsored", async ({ page }) => {
    await page.goto("/");
    const group = page.locator('[data-store-showcase] [data-affiliate-group="showcase"]');
    for (const id of ["naver", "coupang"] as const) {
      const store = channels[id];
      const link = group.getByRole("link", { name: `${store.linkLabel} 새 창으로 열기` });
      await expect(link).toHaveAttribute("href", store.urls.showcase);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("data-link-placement", "showcase");
      await expect(link).toHaveAttribute("rel", store.isAffiliate ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer");
    }
  });

  test("the showcase is a secondary block: the page keeps exactly one filled button", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-store-showcase] [data-slot="button"][data-variant="primary"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="button"][data-variant="primary"]')).toHaveCount(1);
  });

  test("the legacy showcase is gone", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-storefront-showcase], #storefront")).toHaveCount(0);
  });
});

test.describe("the showcase is home-only (S08)", () => {
  test("absent while a deep link is loading", async ({ page }) => {
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 20_000 });
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator("[data-loading-stage]")).toBeVisible();
    await expect(page.locator("[data-store-showcase]")).toHaveCount(0);
  });

  test("absent on a settled result", async ({ page }) => {
    await mockTrack(page, trackData("delivered", { trackingNumber: FAKE.domestic }));
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator("[data-result-view] h2")).toBeVisible();
    await expect(page.locator("[data-store-showcase]")).toHaveCount(0);
  });

  test("absent on an error", async ({ page }) => {
    await mockTrack(page, "notFound404");
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-result-view="error"]')).toBeVisible();
    await expect(page.locator("[data-store-showcase]")).toHaveCount(0);
  });
});

test.describe("footer (S08)", () => {
  for (const route of [
    { name: "home", path: "/" },
    { name: "privacy", path: "/privacy" }
  ] as const) {
    test(`${route.name}: the footer carries the note, '개인정보처리방침' and one 톡톡 link`, async ({ page }) => {
      await page.goto(route.path);
      const footer = page.getByRole("contentinfo");
      await expect(footer).toHaveCount(1);
      await expect(footer.getByText(resultCopy.footerNote)).toBeVisible();
      await expect(footer.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute("href", "/privacy");
      const talk = footer.getByRole("link", { name: `${channels.talk.labels.footer} 새 창으로 열기` });
      await expect(talk).toHaveAttribute("href", channels.talk.url);
      await expect(talk).toHaveAttribute("data-link-placement", "footer");
      await expect(footer.locator(`a[href="${channels.talk.url}"]`)).toHaveCount(1);
    });
  }

  test("톡톡 appears at most three times on a result screen: header, one state place, footer", async ({ page }) => {
    await mockTrack(page, trackData("pending", { trackingNumber: FAKE.domestic }));
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator("[data-result-view] h2")).toBeVisible();
    const talkLinks = page.locator(`a[href="${channels.talk.url}"]`);
    expect(await talkLinks.count()).toBeLessThanOrEqual(3);
    await expect(page.getByRole("contentinfo").locator(`a[href="${channels.talk.url}"]`)).toHaveCount(1);
  });

  test("톡톡 appears at most three times on an error screen", async ({ page }) => {
    await mockTrack(page, "notFound404");
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator('[data-result-view="error"]')).toBeVisible();
    expect(await page.locator(`a[href="${channels.talk.url}"]`).count()).toBeLessThanOrEqual(3);
  });
});
