import { channels } from "@/config/site.config";
import type { FeaturedItem } from "@/lib/config/types";
import { parseInstant } from "@/lib/tracking/time";
import type { RecommendationContext, RevenueView } from "@/lib/tracking/types";

/**
 * Recommendations after a result (spec §8 "추천", §16 item 10). Pure: time always arrives as `now` (contract §11.1 rule 5).
 * - Only items whose `contexts` name the result's state and whose validity span [validFrom, validUntil) contains `now`.
 * - Approved rules (inline list): a product-detail link is required; '이번 주' only for a span of 7 days or less;
 *   a price only when it was checked at most 7 days before `now`.
 * - Fallback rules (approval 10 not granted, '운영자 추천' dialog): same context and span rules, never a price or '이번 주'.
 */
export interface SelectedRecommendation {
  readonly item: FeaturedItem;
  readonly showPrice: boolean;
  readonly weeklyLabel: boolean;
}

export type RecommendationPresentation = "inline" | "dialog";

/** Approval 10 (roadmap §4 ledger row 10) is pending: the spec §16 item 10 fallback keeps the dialog. Task 10 switches this. */
export const RECOMMENDATION_PRESENTATION: RecommendationPresentation = "dialog";

/** At most three items per result (three short lines at 375 px). */
export const RECOMMENDATION_LIMIT = 3;
export const WEEKLY_LABEL_MAX_DAYS = 7;
export const PRICE_CHECK_MAX_AGE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Store-home and 톡톡 links from the config; none of them is a product detail page. */
const NON_DETAIL_LINKS: ReadonlySet<string> = new Set<string>([
  ...Object.values(channels.naver.urls),
  ...Object.values(channels.coupang.urls),
  channels.talk.url
]);

export function isProductDetailLink(href: string): boolean {
  return href.startsWith("https://") && !NON_DETAIL_LINKS.has(href);
}

interface ValiditySpan {
  readonly from: number;
  readonly until: number;
}

function spanOf(item: FeaturedItem): ValiditySpan | null {
  const from = parseInstant(item.validFrom);
  const until = parseInstant(item.validUntil);
  return from === null || until === null ? null : { from: from.getTime(), until: until.getTime() };
}

function isValidAt(item: FeaturedItem, now: Date): boolean {
  const span = spanOf(item);
  const time = now.getTime();
  return span !== null && span.from <= time && time < span.until;
}

function isWeekly(item: FeaturedItem): boolean {
  const span = spanOf(item);
  return span !== null && span.until - span.from <= WEEKLY_LABEL_MAX_DAYS * DAY_MS;
}

function hasFreshPrice(item: FeaturedItem, now: Date): boolean {
  if (item.priceLabel === null || item.priceCheckedAt === null) return false;
  const checked = parseInstant(item.priceCheckedAt);
  if (checked === null) return false;
  const age = now.getTime() - checked.getTime();
  return age >= 0 && age <= PRICE_CHECK_MAX_AGE_DAYS * DAY_MS;
}

function itemsFor(items: readonly FeaturedItem[], context: RecommendationContext, now: Date): readonly FeaturedItem[] {
  return items.filter((item) => item.contexts.includes(context) && isValidAt(item, now));
}

export function selectRecommendations(
  items: readonly FeaturedItem[],
  context: RecommendationContext,
  now: Date,
  limit: number
): readonly SelectedRecommendation[] {
  return itemsFor(items, context, now)
    .filter((item) => isProductDetailLink(item.href))
    .slice(0, Math.max(0, limit))
    .map((item) => ({ item, showPrice: hasFreshPrice(item, now), weeklyLabel: isWeekly(item) }));
}

export function selectOperatorPicks(
  items: readonly FeaturedItem[],
  context: RecommendationContext,
  now: Date,
  limit: number
): readonly SelectedRecommendation[] {
  return itemsFor(items, context, now)
    .slice(0, Math.max(0, limit))
    .map((item) => ({ item, showPrice: false, weeklyLabel: false }));
}

/**
 * The recommendations a settled result shows. Nothing when the view allows none (problem states, overdue, loading);
 * "optional" states (customsWaiting, customsCleared) behave like "inline" — an item appears only if it names the state.
 */
export function recommendationsForView(
  revenue: RevenueView,
  items: readonly FeaturedItem[],
  now: Date,
  presentation: RecommendationPresentation
): readonly SelectedRecommendation[] {
  const context = revenue.recommendationContext;
  if (revenue.recommendations === "none" || context === null) return [];
  return presentation === "inline"
    ? selectRecommendations(items, context, now, RECOMMENDATION_LIMIT)
    : selectOperatorPicks(items, context, now, RECOMMENDATION_LIMIT);
}
