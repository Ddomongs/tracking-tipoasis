import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { channels, resultCopy, siteConfig } from "@/config/site.config";
import { SiteConfigSchema, formatConfigIssues } from "@/lib/config/schema";
import type { FeaturedItem } from "@/lib/config/types";
import {
  PRICE_CHECK_MAX_AGE_DAYS,
  RECOMMENDATION_LIMIT,
  RECOMMENDATION_PRESENTATION,
  WEEKLY_LABEL_MAX_DAYS,
  isProductDetailLink,
  recommendationsForView,
  selectOperatorPicks,
  selectRecommendations,
  type SelectedRecommendation
} from "@/lib/tracking/recommendations";
import type { RevenueView } from "@/lib/tracking/types";
import { FIXTURE_FEATURED } from "../fixtures/config-fixtures";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

function fixture(id: string): FeaturedItem {
  const item = FIXTURE_FEATURED.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`FIXTURE_FEATURED has no item "${id}"`);
  return item;
}

const WEEKLY = fixture("fx-weekly-mount");
const MONTH = fixture("fx-month-case");
/** An item that still points at a store home — the state of the shipped config until the operator supplies detail links. */
const STORE_HOME: FeaturedItem = {
  ...MONTH,
  id: "fx-store-home",
  channel: "naver",
  href: channels.naver.urls.showcase,
  isAffiliate: false
};
/** A window one day longer than the '이번 주' limit. */
const EIGHT_DAYS: FeaturedItem = { ...WEEKLY, id: "fx-eight-days", validUntil: "2026-09-29T00:00:00+09:00" };

const at = (iso: string): Date => new Date(iso);
const ids = (list: readonly SelectedRecommendation[]): readonly string[] => list.map((entry) => entry.item.id);

function revenue(overrides: Partial<RevenueView>): RevenueView {
  return { tier: "quiet", stores: "none", recommendations: "inline", recommendationContext: "pending", adsAllowed: true, ...overrides };
}

test.describe("selectRecommendations (approved rules, spec §8)", () => {
  test("keeps the items of the context inside their validity window, in config order", () => {
    expect(ids(selectRecommendations(FIXTURE_FEATURED, "pending", FIXTURE_NOW, 5))).toEqual(["fx-weekly-mount", "fx-month-case"]);
    expect(ids(selectRecommendations(FIXTURE_FEATURED, "customsWaiting", FIXTURE_NOW, 5))).toEqual(["fx-month-case"]);
  });

  test("the window is [validFrom, validUntil): an item appears at its start and is gone at its end", () => {
    expect(ids(selectRecommendations([WEEKLY], "pending", at("2026-09-20T23:59:59+09:00"), 5))).toEqual([]);
    expect(ids(selectRecommendations([WEEKLY], "pending", at("2026-09-21T00:00:00+09:00"), 5))).toEqual(["fx-weekly-mount"]);
    expect(ids(selectRecommendations([WEEKLY], "pending", at("2026-09-27T23:59:59+09:00"), 5))).toEqual(["fx-weekly-mount"]);
    expect(ids(selectRecommendations([WEEKLY], "pending", at("2026-09-28T00:00:00+09:00"), 5))).toEqual([]);
  });

  test("'이번 주' only for a validity window of 7 days or less", () => {
    expect(WEEKLY_LABEL_MAX_DAYS).toBe(7);
    const [weekly, month] = selectRecommendations([WEEKLY, MONTH], "pending", FIXTURE_NOW, 5);
    expect(weekly?.weeklyLabel).toBe(true);
    expect(month?.weeklyLabel).toBe(false);
    expect(selectRecommendations([EIGHT_DAYS], "pending", FIXTURE_NOW, 5)[0]?.weeklyLabel).toBe(false);
  });

  test("a store-home link is never recommended, even with a fresh price", () => {
    expect(ids(selectRecommendations([STORE_HOME, MONTH], "pending", FIXTURE_NOW, 5))).toEqual(["fx-month-case"]);
  });

  test("a price shows only when it was checked at most 7 days before now", () => {
    expect(PRICE_CHECK_MAX_AGE_DAYS).toBe(7);
    const priceAt = (iso: string): boolean | undefined => selectRecommendations([MONTH], "pending", at(iso), 5)[0]?.showPrice;
    expect(priceAt("2026-09-26T14:05:00+09:00")).toBe(true);
    expect(priceAt("2026-10-01T10:00:00+09:00")).toBe(true);
    expect(priceAt("2026-10-01T10:00:01+09:00")).toBe(false);
    expect(priceAt("2026-09-24T09:59:59+09:00")).toBe(false);
    expect(selectRecommendations([WEEKLY], "pending", FIXTURE_NOW, 5)[0]?.showPrice).toBe(false);
  });

  test("the limit cuts the list; zero or less returns nothing", () => {
    expect(ids(selectRecommendations(FIXTURE_FEATURED, "pending", FIXTURE_NOW, 1))).toEqual(["fx-weekly-mount"]);
    expect(selectRecommendations(FIXTURE_FEATURED, "pending", FIXTURE_NOW, 0)).toEqual([]);
    expect(selectRecommendations(FIXTURE_FEATURED, "pending", FIXTURE_NOW, -2)).toEqual([]);
  });
});

test.describe("selectOperatorPicks (approval-10 fallback: '운영자 추천' dialog)", () => {
  test("uses the same context and window rules but keeps store-home links", () => {
    expect(ids(selectOperatorPicks([STORE_HOME, WEEKLY, MONTH], "pending", FIXTURE_NOW, 5))).toEqual([
      "fx-store-home",
      "fx-weekly-mount",
      "fx-month-case"
    ]);
    expect(ids(selectOperatorPicks([WEEKLY], "pending", at("2026-09-28T00:00:00+09:00"), 5))).toEqual([]);
  });

  test("never shows a price or '이번 주'", () => {
    for (const entry of selectOperatorPicks([STORE_HOME, WEEKLY, MONTH], "pending", FIXTURE_NOW, 5)) {
      expect(entry.showPrice, entry.item.id).toBe(false);
      expect(entry.weeklyLabel, entry.item.id).toBe(false);
    }
  });
});

test.describe("recommendationsForView", () => {
  test("nothing when the view allows no recommendations or has no context", () => {
    expect(recommendationsForView(revenue({ recommendations: "none" }), FIXTURE_FEATURED, FIXTURE_NOW, "inline")).toEqual([]);
    expect(recommendationsForView(revenue({ recommendationContext: null }), FIXTURE_FEATURED, FIXTURE_NOW, "dialog")).toEqual([]);
  });

  test("'optional' states show only items that name the state in their contexts", () => {
    const view = revenue({ recommendations: "optional", recommendationContext: "customsCleared" });
    expect(ids(recommendationsForView(view, FIXTURE_FEATURED, FIXTURE_NOW, "inline"))).toEqual(["fx-month-case"]);
    expect(recommendationsForView(view, [WEEKLY], FIXTURE_NOW, "inline")).toEqual([]);
  });

  test("the presentation picks the rule set, and the list never exceeds RECOMMENDATION_LIMIT", () => {
    expect(RECOMMENDATION_LIMIT).toBe(3);
    const many = [STORE_HOME, WEEKLY, MONTH, { ...MONTH, id: "fx-month-copy" }, { ...WEEKLY, id: "fx-weekly-copy" }];
    expect(ids(recommendationsForView(revenue({}), many, FIXTURE_NOW, "inline"))).toEqual(["fx-weekly-mount", "fx-month-case", "fx-month-copy"]);
    expect(ids(recommendationsForView(revenue({}), many, FIXTURE_NOW, "dialog"))).toEqual(["fx-store-home", "fx-weekly-mount", "fx-month-case"]);
  });
});

test("isProductDetailLink: https links that are not a configured store-home or 톡톡 link", () => {
  for (const href of [...Object.values(channels.naver.urls), ...Object.values(channels.coupang.urls), channels.talk.url]) {
    expect(isProductDetailLink(href), href).toBe(false);
  }
  expect(isProductDetailLink(WEEKLY.href)).toBe(true);
  expect(isProductDetailLink(MONTH.href)).toBe(true);
  expect(isProductDetailLink(WEEKLY.href.replace("https://", "http://"))).toBe(false);
});

test("RECOMMENDATION_PRESENTATION follows approvalconst status = /^| 10 | [^|]+| (w+)[^|]*|/m.exec(ledger)?.[1]; // the cell may carry a date and a notein the roadmap ledger", () => {
  const ledger = readFileSync(path.join(REPO_ROOT, "docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md"), "utf8");
  // The status cell may carry a date and a note after the word ("approved 2026-09-27 (operator must confirm …)").
  const status = /^\| 10 \| [^|]+\| (\w+)[^|]*\|/m.exec(ledger)?.[1];
  expect(status, "approvalconst status = /^| 10 | [^|]+| (w+)[^|]*|/m.exec(ledger)?.[1]; // the cell may carry a date and a noterow not found in roadmap §4").toBeTruthy();
  expect(RECOMMENDATION_PRESENTATION).toBe(status === "approved" ? "inline" : "dialog");
});

test.describe("supplementary copy in the config (S08)", () => {
  test("resultCopy carries the S08 strings and the shipped config still parses", () => {
    expect(resultCopy.recommendationsOpen).toBe("운영자 추천 상품 보기");
    expect(resultCopy.recommendationsClose).toBe("닫기");
    expect(resultCopy.recommendationPriceChecked).toBe("{date} 확인");
    expect(resultCopy.showcaseTitle).toBe("판매 중인 상품 둘러보기");
    expect(resultCopy.footerNote.length).toBeGreaterThan(10);
    expect(resultCopy.adSlotLabel).toBe("광고");
    const parsed = SiteConfigSchema.safeParse(siteConfig);
    expect(parsed.success, parsed.success ? "" : formatConfigIssues(parsed.error)).toBe(true);
  });

  test("the price note keeps exactly its {date} slot and every S08 string stays token-free otherwise", () => {
    const broken = SiteConfigSchema.safeParse({
      ...siteConfig,
      resultCopy: { ...siteConfig.resultCopy, recommendationPriceChecked: "가격 확인", showcaseTitle: "{date} 상품" }
    });
    expect(broken.success).toBe(false);
    if (broken.success) return;
    const issues = formatConfigIssues(broken.error);
    expect(issues).toContain("resultCopy.recommendationPriceChecked: {date} 자리가 필요합니다");
    expect(issues).toContain("resultCopy.showcaseTitle: 허용되지 않은 토큰 {date}입니다");
  });
});

test.describe("legacy supplementary pieces are gone (S08)", () => {
  const LEGACY_FILES = [
    "components/RecommendedProducts.tsx",
    "components/StorefrontShowcase.tsx",
    "components/SiteFooter.tsx",
    "components/AnimatedIcon.tsx",
    "lib/storefront.ts"
  ] as const;
  const LEGACY_MENTION = /@\/lib\/storefront|AnimatedIcon|RecommendedProducts|StorefrontShowcase|@\/components\/SiteFooter"|tt-legacy-dark|data-storefront-showcase|\.brand-panel|\.section-title|\.section-copy/;

  function sourceFiles(dir: string): string[] {
    return readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
      const relative = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(relative);
      return /\.(ts|tsx|css)$/.test(entry.name) ? [relative] : [];
    });
  }

  test("the five legacy files are deleted", () => {
    expect(LEGACY_FILES.filter((file) => existsSync(path.join(REPO_ROOT, file)))).toEqual([]);
  });

  test("no app, component, library or config file mentions them or the legacy band", () => {
    const offenders = ["app", "components", "lib", "config"]
      .flatMap(sourceFiles)
      .filter((file) => LEGACY_MENTION.test(readFileSync(path.join(REPO_ROOT, file), "utf8")));
    expect(offenders).toEqual([]);
  });
});
