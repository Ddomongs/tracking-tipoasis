import { siteConfig } from "@/config/site.config";
import type { FeaturedItem, HolidayPeriod, Notice, SiteConfig } from "@/lib/config/types";

type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { readonly [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** Recursive partial of SiteConfig; arrays (and tuples) are replaced as a whole. */
export type DeepPartialConfig = DeepPartial<SiteConfig>;

export const FIXTURE_HOLIDAYS: readonly HolidayPeriod[] = [
  { id: "2026-chuseok", name: "추석 연휴", dates: ["2026-09-24", "2026-09-25", "2026-09-26"], badge: "추석 연휴 영향 · 1~2일 늦어질 수 있어요" },
  { id: "2026-foundation-day", name: "개천절", dates: ["2026-10-03", "2026-10-05"], badge: "개천절 영향 · 1일 늦어질 수 있어요" },
  { id: "2026-hangul-day", name: "한글날", dates: ["2026-10-09"], badge: "한글날 영향 · 1일 늦어질 수 있어요" },
  { id: "2026-christmas", name: "성탄절", dates: ["2026-12-25"], badge: "성탄절 영향 · 1일 늦어질 수 있어요" },
  { id: "2027-seollal", name: "설 연휴", dates: ["2027-02-06", "2027-02-07", "2027-02-08", "2027-02-09"], badge: "설 연휴 영향 · 1~2일 늦어질 수 있어요" }
];

export const FIXTURE_NOTICES: readonly Notice[] = [
  {
    id: "fx-holiday", kind: "holiday", title: "추석 연휴 배송 안내",
    body: "추석 연휴(9/24~26)와 주말에는 통관·택배가 쉬어요. 9월 28일(월)부터 순서대로 진행돼요.",
    startsAt: "2026-09-21T00:00:00+09:00", endsAt: "2026-09-29T00:00:00+09:00", home: true,
    guideKeys: ["pending", "customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp", "inTransit"], cs: true
  },
  {
    id: "fx-outage", kind: "outage", title: "UNI-PASS 점검 안내",
    body: "UNI-PASS 점검(22:00~24:00) 중에는 통관 정보가 늦게 보일 수 있어요.",
    startsAt: "2026-09-26T22:00:00+09:00", endsAt: "2026-09-27T00:00:00+09:00", home: true,
    guideKeys: ["loading", "temporaryDelay", "noResponse", "offline", "notFound", "customsWaiting"], cs: true
  },
  {
    id: "fx-info", kind: "info", title: "배송 조회 안내",
    body: "조회 결과는 저장하지 않아요. 같은 탭에서 30분 안에 다시 볼 수 있어요.",
    startsAt: "2026-09-01T00:00:00+09:00", endsAt: "2026-10-01T00:00:00+09:00", home: true, guideKeys: [], cs: false
  },
  {
    id: "fx-expired", kind: "delay", title: "택배 없는 날 안내",
    body: "택배 없는 날에는 배송이 쉬어요.",
    startsAt: "2026-08-13T00:00:00+09:00", endsAt: "2026-08-15T00:00:00+09:00", home: true, guideKeys: ["inTransit"], cs: true
  }
];

export const FIXTURE_FEATURED: readonly FeaturedItem[] = [
  {
    id: "fx-weekly-mount", name: "차량용 휴대폰 거치대", channel: "naver",
    href: "https://smartstore.naver.com/example/products/0000000001", isAffiliate: false,
    validFrom: "2026-09-21T00:00:00+09:00", validUntil: "2026-09-28T00:00:00+09:00", priceLabel: null, priceCheckedAt: null,
    contexts: ["pending", "inTransit", "delivered"]
  },
  {
    id: "fx-month-case", name: "아크릴 전시 케이스", channel: "coupang",
    href: "https://www.coupang.com/vp/products/0000000002", isAffiliate: true,
    validFrom: "2026-09-01T00:00:00+09:00", validUntil: "2026-10-31T23:59:59+09:00",
    priceLabel: "39,000원", priceCheckedAt: "2026-09-24T10:00:00+09:00",
    contexts: ["pending", "customsWaiting", "customsCleared", "inTransit", "delivered"]
  }
];

/** siteConfig with deterministic notices, holidays and featured items around FIXTURE_NOW (2026-09-26T14:05 KST). */
export const FIXTURE_CONFIG: SiteConfig = {
  ...siteConfig,
  calendar: { ...siteConfig.calendar, holidays: FIXTURE_HOLIDAYS, carrierDeliversSaturday: false },
  notices: FIXTURE_NOTICES,
  featuredProducts: FIXTURE_FEATURED
};

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeDeep(base: unknown, patch: unknown): unknown {
  if (patch === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    merged[key] = mergeDeep(base[key], value);
  }
  return merged;
}

/** FIXTURE_CONFIG with `patch` merged in (objects deep, arrays replaced). Invalid values are allowed on purpose for schema tests. */
export function withConfig(patch: DeepPartialConfig): SiteConfig {
  return mergeDeep(FIXTURE_CONFIG, patch) as SiteConfig;
}
