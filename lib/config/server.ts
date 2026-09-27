import { siteConfig } from "@/config/site.config";
import { SiteConfigSchema, formatConfigIssues } from "@/lib/config/schema";
import type { SiteConfig } from "@/lib/config/types";
import { addCalendarDays, kstDateKey } from "@/lib/tracking/time";

// Server-only by rule (contract §11.1 rule 4, enforced by tests/unit/module-boundaries.spec.ts): never import from a "use client" file.

export const HOLIDAY_WINDOW_DAYS = 60;

let cachedConfig: SiteConfig | null = null;

/** Parses any value as SiteConfig; throws an Error whose message lists one Korean 'path: message' line per issue. */
export function parseSiteConfig(value: unknown): SiteConfig {
  const result = SiteConfigSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`config/site.config.ts 설정 오류\n${formatConfigIssues(result.error)}`);
  }
  return result.data;
}

/** Korean warnings, one per calendar year that has days in the next 60 (KST) but no holiday data. */
export function holidayCoverageWarnings(config: SiteConfig, now: Date): readonly string[] {
  const coveredYears = new Set(config.calendar.holidays.flatMap((period) => period.dates.map((date) => date.slice(0, 4))));
  const today = kstDateKey(now);
  const warnedYears = new Set<string>();
  const warnings: string[] = [];
  for (let offset = 0; offset < HOLIDAY_WINDOW_DAYS; offset += 1) {
    const day = addCalendarDays(today, offset);
    const year = day.slice(0, 4);
    if (coveredYears.has(year) || warnedYears.has(year)) continue;
    warnedYears.add(year);
    warnings.push(`calendar.holidays: ${year}년 공휴일이 없습니다. ${day}부터 걱정 기준일 계산에서 공휴일이 빠집니다. 월력요항을 보고 추가해 주세요.`);
  }
  return warnings;
}

/** The validated operator config. Parsed once per server process; the first parse logs holiday coverage warnings. */
export function getSiteConfig(): SiteConfig {
  if (cachedConfig !== null) return cachedConfig;
  const parsed = parseSiteConfig(siteConfig);
  for (const warning of holidayCoverageWarnings(parsed, new Date())) {
    console.warn(`[site.config] ${warning}`);
  }
  cachedConfig = parsed;
  return parsed;
}
