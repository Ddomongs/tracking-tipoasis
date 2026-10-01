import { expect, test } from "@playwright/test";
import { siteConfig } from "@/config/site.config";
import {
  PREVIEW_NUMBERS,
  PREVIEW_OVERDUE_AGE_DAYS,
  PREVIEW_SCENARIO_IDS,
  buildPreviewScenario,
  buildPreviewScenarios
} from "@/lib/cs/preview-outcomes";
import { HBL_LIKE_PATTERN, findDisallowedDigitRuns } from "@/lib/privacy/number-patterns";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { addCalendarDays } from "@/lib/tracking/time";
import { GUIDE_KEYS } from "@/lib/tracking/types";
import { FIXTURE_NOW } from "../fixtures/tracking-fixtures";

const DAY_MS = 86_400_000;
const TIMES = ["00:30", "14:05", "23:50"] as const;
/** Every day around 2026 추석 and the October holidays, and around 2027 설 — weekends and long breaks included. */
const DAYS: readonly string[] = [
  ...Array.from({ length: 36 }, (_, offset) => addCalendarDays("2026-09-15", offset)),
  ...Array.from({ length: 15 }, (_, offset) => addCalendarDays("2027-02-01", offset))
];

test("the scenarios cover every result state once, plus the overdue variant", () => {
  const scenarios = buildPreviewScenarios(FIXTURE_NOW);
  expect(scenarios.map((scenario) => scenario.id)).toEqual([...PREVIEW_SCENARIO_IDS]);
  const keys = [...new Set(scenarios.map((scenario) => scenario.guideKey))].sort();
  expect(keys).toEqual(GUIDE_KEYS.filter((key) => key !== "idle" && key !== "loading").sort());
  expect(scenarios.filter((scenario) => scenario.overdue).map((scenario) => scenario.id)).toEqual(["customsWaitingOverdue"]);
});

test("every scenario derives to its state on any day and time around the holidays", () => {
  const mismatches: string[] = [];
  for (const day of DAYS) {
    for (const time of TIMES) {
      const now = new Date(`${day}T${time}:00+09:00`);
      for (const scenario of buildPreviewScenarios(now)) {
        const view = deriveTrackingView(scenario.outcome, now, siteConfig);
        if (view.guideKey !== scenario.guideKey || view.overdue !== scenario.overdue) {
          mismatches.push(`${day} ${time} ${scenario.id} → ${view.guideKey}${view.overdue ? " (overdue)" : ""}`);
        }
      }
    }
  }
  expect(mismatches).toEqual([]);
});

test("the carrier-cut variant shows a cut journey and the carrier delay line", () => {
  const scenario = buildPreviewScenario("customsClearedCarrierCut", FIXTURE_NOW);
  const view = deriveTrackingView(scenario.outcome, FIXTURE_NOW, siteConfig);
  expect(view.spine.issue?.kind).toBe("cut");
  expect(view.auxiliaryLine).not.toBeNull();
});

test("only the fake numbers appear, and the overdue scenario is read days after its events", () => {
  const scenarios = buildPreviewScenarios(FIXTURE_NOW);
  const allowed = new Set<string>(Object.values(PREVIEW_NUMBERS));
  for (const scenario of scenarios) {
    expect(allowed.has(scenario.outcome.request.number), scenario.id).toBe(true);
    if (scenario.outcome.kind === "success") {
      expect(scenario.outcome.data.trackingNumber, scenario.id).toBe(scenario.outcome.request.number);
    }
  }
  const text = JSON.stringify(scenarios);
  expect(findDisallowedDigitRuns(text)).toEqual([]);
  expect(new Set(text.match(HBL_LIKE_PATTERN) ?? [])).toEqual(new Set([PREVIEW_NUMBERS.hbl]));
  const overdue = buildPreviewScenario("customsWaitingOverdue", FIXTURE_NOW);
  if (overdue.outcome.kind !== "success") throw new Error("the overdue scenario is a success outcome");
  expect(FIXTURE_NOW.getTime() - Date.parse(overdue.outcome.data.lastUpdated)).toBeGreaterThanOrEqual(PREVIEW_OVERDUE_AGE_DAYS * DAY_MS);
});

test("the same instant gives the same scenarios", () => {
  expect(buildPreviewScenarios(FIXTURE_NOW)).toEqual(buildPreviewScenarios(new Date(FIXTURE_NOW.getTime())));
});
