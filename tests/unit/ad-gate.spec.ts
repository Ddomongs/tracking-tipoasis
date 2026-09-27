import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { AD_TIMING_POLICY, adGateState, manualSlotMode, shouldInsertAdLoader } from "@/lib/ads/ad-gate";
import type { AdGateInput, AdTimingPolicy } from "@/lib/ads/ad-gate";
import { getAdSignals, setAdSignals, subscribeAdSignals } from "@/lib/ads/ad-signals";
import type { ScrubStatus } from "@/lib/privacy/url-scrub";
import { FAKE } from "../fixtures/tracking-fixtures";
import { ads } from "@/config/site.config";

const POLICIES: readonly AdTimingPolicy[] = ["afterScrub", "afterAllowedResult", "neverOnNumberRoutes"];
const SCRUBS: ReadonlyArray<ScrubStatus | "pending"> = ["pending", "scrubbed", "notNeeded", "failed"];
const ENTRIES: ReadonlyArray<AdGateInput["entry"]> = ["home", "deepLink"];

function gate(overrides: Partial<AdGateInput>): boolean {
  return shouldInsertAdLoader({
    pathname: "/",
    entry: "home",
    scrub: "pending",
    resultAdsAllowed: null,
    scrolledPastLookup: false,
    policy: "afterScrub",
    ...overrides
  });
}

test("no policy inserts the loader on a number, tracking-like or /internal path", () => {
  const paths = [
    `/${FAKE.domestic}`,
    `/${FAKE.hbl}`,
    `/${FAKE.domestic}.html`,
    `/a/${FAKE.domestic}`,
    "/internal",
    "/internal/cs-helper"
  ];
  for (const policy of POLICIES) {
    for (const pathname of paths) {
      for (const entry of ENTRIES) {
        for (const scrub of SCRUBS) {
          const allowed = gate({ policy, pathname, entry, scrub, resultAdsAllowed: true, scrolledPastLookup: true });
          expect(allowed, `${policy} ${pathname} ${entry} ${scrub}`).toBe(false);
        }
      }
    }
  }
});

test("a failed scrub keeps the loader out under every policy", () => {
  for (const policy of POLICIES) {
    for (const entry of ENTRIES) {
      for (const pathname of ["/", "/privacy"]) {
        const allowed = gate({ policy, entry, pathname, scrub: "failed", resultAdsAllowed: true, scrolledPastLookup: true });
        expect(allowed, `${policy} ${entry} ${pathname}`).toBe(false);
      }
    }
  }
});

test("afterScrub: home documents at once, deep-link documents only after a confirmed scrub", () => {
  expect(gate({ policy: "afterScrub", entry: "home", scrub: "pending" })).toBe(true);
  expect(gate({ policy: "afterScrub", entry: "home", scrub: "notNeeded" })).toBe(true);
  expect(gate({ policy: "afterScrub", entry: "home", pathname: "/privacy" })).toBe(true);
  expect(gate({ policy: "afterScrub", entry: "deepLink", scrub: "pending" })).toBe(false);
  expect(gate({ policy: "afterScrub", entry: "deepLink", scrub: "notNeeded" })).toBe(false);
  expect(gate({ policy: "afterScrub", entry: "deepLink", scrub: "scrubbed" })).toBe(true);
  expect(gate({ policy: "afterScrub", entry: "deepLink", scrub: "scrubbed", pathname: "/privacy" })).toBe(true);
});

test("neverOnNumberRoutes: only documents that started on '/' or /privacy", () => {
  expect(gate({ policy: "neverOnNumberRoutes", entry: "home", scrub: "pending" })).toBe(true);
  expect(gate({ policy: "neverOnNumberRoutes", entry: "home", pathname: "/privacy" })).toBe(true);
  for (const scrub of ["pending", "scrubbed", "notNeeded"] as const) {
    expect(gate({ policy: "neverOnNumberRoutes", entry: "deepLink", scrub, resultAdsAllowed: true }), scrub).toBe(false);
  }
});

test("afterAllowedResult (approval 7): home after an allowed result or a scroll, deep links after the scrub and an allowed result, never during a problem result", () => {
  const base = {
    pathname: "/",
    scrub: "pending",
    resultAdsAllowed: null,
    scrolledPastLookup: false,
    policy: "afterAllowedResult"
  } as const;
  expect(gate({ ...base, entry: "home" })).toBe(false);
  expect(gate({ ...base, entry: "home", scrolledPastLookup: true })).toBe(true);
  expect(gate({ ...base, entry: "home", resultAdsAllowed: true })).toBe(true);
  expect(gate({ ...base, entry: "home", resultAdsAllowed: false, scrolledPastLookup: true })).toBe(false);
  expect(gate({ ...base, entry: "deepLink", resultAdsAllowed: true })).toBe(false);
  expect(gate({ ...base, entry: "deepLink", scrub: "scrubbed" })).toBe(false);
  expect(gate({ ...base, entry: "deepLink", scrub: "scrubbed", scrolledPastLookup: true })).toBe(false);
  expect(gate({ ...base, entry: "deepLink", scrub: "scrubbed", resultAdsAllowed: false })).toBe(false);
  expect(gate({ ...base, entry: "deepLink", scrub: "scrubbed", resultAdsAllowed: true })).toBe(true);
  expect(adGateState({ ...base, entry: "home" })).toBe("waiting");
  expect(adGateState({ ...base, entry: "deepLink" })).toBe("waiting");
});

test("AD_TIMING_POLICY follows approvals 6 and 7 in the roadmap ledger", () => {
  const ledger = readFileSync(path.join(process.cwd(), "docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md"), "utf8");
  // The status cell may carry a date after the word ("approved 2026-09-27").
  const statusOf = (row: number): string | undefined => new RegExp(`^\\| ${row} \\| [^|]+\\| (\\w+)[^|]*\\|`, "m").exec(ledger)?.[1];
  const six = statusOf(6);
  const seven = statusOf(7);
  expect(six, "approval 6 row not found in roadmap §4").toBeTruthy();
  expect(seven, "approval 7 row not found in roadmap §4").toBeTruthy();
  const expected: AdTimingPolicy =
    six === "approved" && seven === "approved" ? "afterAllowedResult" : six === "approved" ? "afterScrub" : "neverOnNumberRoutes";
  expect(AD_TIMING_POLICY).toBe(expected);
});

test("ad signals: per-document entry, change-only notifications, sticky failed scrub", () => {
  // No window in this Node process: the entry falls back to the fail-closed "deepLink".
  expect(getAdSignals()).toEqual({ entry: "deepLink", scrub: "pending", resultAdsAllowed: null, scrolledPastLookup: false });
  let notified = 0;
  const unsubscribe = subscribeAdSignals(() => {
    notified += 1;
  });

  setAdSignals({ scrub: "scrubbed" });
  expect(getAdSignals().scrub).toBe("scrubbed");
  expect(notified).toBe(1);
  setAdSignals({ scrub: "scrubbed" });
  expect(notified).toBe(1);

  const before = getAdSignals();
  setAdSignals({ resultAdsAllowed: true });
  expect(before.resultAdsAllowed).toBeNull();
  expect(getAdSignals().resultAdsAllowed).toBe(true);
  expect(notified).toBe(2);

  setAdSignals({ scrub: "failed" });
  setAdSignals({ scrub: "scrubbed" });
  expect(getAdSignals().scrub).toBe("failed");
  expect(notified).toBe(3);

  unsubscribe();
  setAdSignals({ scrolledPastLookup: true });
  expect(notified).toBe(3);
});

test.describe("adGateState and manualSlotMode (S08)", () => {
  const HOME: AdGateInput = {
    pathname: "/",
    entry: "home",
    scrub: "pending",
    resultAdsAllowed: null,
    scrolledPastLookup: false,
    policy: "afterScrub"
  };

  test("afterScrub: home is open at once; a deep link waits for its scrub, then opens; a failed scrub closes it", () => {
    expect(adGateState(HOME)).toBe("open");
    expect(adGateState({ ...HOME, entry: "deepLink" })).toBe("waiting");
    expect(adGateState({ ...HOME, entry: "deepLink", scrub: "scrubbed" })).toBe("open");
    expect(adGateState({ ...HOME, entry: "deepLink", scrub: "failed" })).toBe("closed");
  });

  test("neverOnNumberRoutes keeps deep-link documents closed; number and internal paths are always closed", () => {
    expect(adGateState({ ...HOME, policy: "neverOnNumberRoutes" })).toBe("open");
    expect(adGateState({ ...HOME, entry: "deepLink", scrub: "scrubbed", policy: "neverOnNumberRoutes" })).toBe("closed");
    expect(adGateState({ ...HOME, pathname: `/${FAKE.domestic}` })).toBe("closed");
    expect(adGateState({ ...HOME, pathname: "/internal/ui-kit" })).toBe("closed");
  });

  test("manualSlotMode: home and allowed results only; reserved while the gate waits, filled while it is open", () => {
    expect(manualSlotMode({ viewMode: "idle", resultAdsAllowed: null, gate: "open" })).toBe("filled");
    expect(manualSlotMode({ viewMode: "idle", resultAdsAllowed: null, gate: "waiting" })).toBe("reserved");
    expect(manualSlotMode({ viewMode: "idle", resultAdsAllowed: null, gate: "closed" })).toBe("none");
    expect(manualSlotMode({ viewMode: "settled", resultAdsAllowed: true, gate: "open" })).toBe("filled");
    expect(manualSlotMode({ viewMode: "settled", resultAdsAllowed: true, gate: "waiting" })).toBe("reserved");
    expect(manualSlotMode({ viewMode: "settled", resultAdsAllowed: false, gate: "open" })).toBe("none");
    expect(manualSlotMode({ viewMode: "settled", resultAdsAllowed: null, gate: "open" })).toBe("none");
    expect(manualSlotMode({ viewMode: "loading", resultAdsAllowed: true, gate: "open" })).toBe("none");
    expect(manualSlotMode({ viewMode: "error", resultAdsAllowed: null, gate: "open" })).toBe("none");
  });

  test("every style's --tt-anchor-reserve equals config.ads.anchorReservePx, and html keeps that scroll padding", () => {
    const stylesDir = path.join(process.cwd(), "app/styles");
    const files = readdirSync(stylesDir).filter((name) => name.endsWith(".css"));
    expect(files).toContain("tokens.css");
    for (const name of files) {
      const values = Array.from(readFileSync(path.join(stylesDir, name), "utf8").matchAll(/--tt-anchor-reserve\s*:\s*([^;]+);/g), (match) =>
        match[1].trim()
      );
      expect(values.length, name).toBeGreaterThan(0);
      for (const value of values) expect(value, name).toBe(`${ads.anchorReservePx}px`);
    }
    const globals = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
    expect(globals).toMatch(/html\s*\{[^}]*scroll-padding-bottom:\s*var\(--tt-anchor-reserve\)/);
  });
});

test("DESIGN.md states the ad-timing exception exactly while approval 7 is not implemented (S08)", () => {
  const design = readFileSync(path.join(process.cwd(), "DESIGN.md"), "utf8");
  const exception = "조회 전에 뜬 하단 광고는 오류 화면에 남을 수 있어요.";
  expect(design.includes(exception)).toBe(AD_TIMING_POLICY !== "afterAllowedResult");
  expect(design).toContain("## 13. 보조 영역과 광고 시점");
});
