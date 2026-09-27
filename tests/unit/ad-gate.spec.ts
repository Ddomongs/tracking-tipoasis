import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { AD_TIMING_POLICY, shouldInsertAdLoader } from "@/lib/ads/ad-gate";
import type { AdGateInput, AdTimingPolicy } from "@/lib/ads/ad-gate";
import { getAdSignals, setAdSignals, subscribeAdSignals } from "@/lib/ads/ad-signals";
import type { ScrubStatus } from "@/lib/privacy/url-scrub";
import { FAKE } from "../fixtures/tracking-fixtures";

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

test("afterAllowedResult stays closed until S08 implements it", () => {
  for (const entry of ENTRIES) {
    for (const scrub of ["pending", "scrubbed", "notNeeded"] as const) {
      const allowed = gate({ policy: "afterAllowedResult", entry, scrub, resultAdsAllowed: true, scrolledPastLookup: true });
      expect(allowed, `${entry} ${scrub}`).toBe(false);
    }
  }
});

test("AD_TIMING_POLICY follows approval 6 in the roadmap ledger", () => {
  const ledger = readFileSync(path.join(process.cwd(), "docs/superpowers/plans/2026-09-26-renewal-00-roadmap.md"), "utf8");
  // The status cell starts with the status word, e.g. "approved 2026-09-27".
  const status = /^\| 6 \| [^|]+\| (\w+)[^|]*\|/m.exec(ledger)?.[1];
  expect(status, "approval 6 row not found in roadmap §4").toBeTruthy();
  if (status === "approved") {
    expect(["afterScrub", "afterAllowedResult"]).toContain(AD_TIMING_POLICY);
  } else {
    expect(AD_TIMING_POLICY).toBe("neverOnNumberRoutes");
  }
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
