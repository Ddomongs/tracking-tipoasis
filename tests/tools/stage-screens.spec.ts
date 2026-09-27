import { test, type Locator, type Page } from "@playwright/test";
import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { customsWaitingData } from "../fixtures/derive-scenarios";

/**
 * Before/after screenshots for each stage (roadmap §6 Step 5, §7 G7).
 * Runs only with PW_SHOTS=before|after and PW_STAGE=S01…S11 against a running `next start`.
 * Output: test-artifacts/stage-screens/<PW_STAGE>-<PW_SHOTS>/<scenario>-<width>.png — outside test-results/,
 * because Playwright empties its output directory at the start of every run.
 * Later stages append entries to SCENARIOS only.
 */
const SHOTS = process.env.PW_SHOTS;
const STAGE = process.env.PW_STAGE ?? "SXX";
const SHOTS_ENABLED = SHOTS === "before" || SHOTS === "after";
const OUTPUT_DIR = `test-artifacts/stage-screens/${STAGE}-${SHOTS ?? "off"}`;
const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const VIEWPORT_HEIGHT = 900;

interface StageScenario {
  readonly name: string;
  readonly path: string;
  readonly prepare?: (page: Page) => Promise<void>;
}

const SCENARIOS: readonly StageScenario[] = [
  { name: "home", path: "/" },
  { name: "deeplink-pending", path: `/${FAKE.domestic}`, prepare: (page) => mockTrack(page, trackData("pending")) },
  { name: "deeplink-customsWaiting", path: `/${FAKE.hbl}`, prepare: (page) => mockTrack(page, trackData("customsWaiting")) },
  { name: "deeplink-inTransit", path: `/${FAKE.hbl}`, prepare: (page) => mockTrack(page, trackData("inTransit")) },
  { name: "deeplink-delivered", path: `/${FAKE.hbl}`, prepare: (page) => mockTrack(page, trackData("delivered")) },
  { name: "deeplink-notFound", path: `/${FAKE.domestic}`, prepare: (page) => mockTrack(page, "notFound404") },
  { name: "privacy", path: "/privacy" },
  // S04: the status slot's problem and choice states (deep links; the tool pins the page clock to FIXTURE_NOW).
  { name: "deeplink-serverError", path: `/${FAKE.domestic}`, prepare: (page) => mockTrack(page, "serverError500") },
  { name: "deeplink-rateLimited", path: `/${FAKE.domestic}`, prepare: (page) => mockTrack(page, "rateLimited429") },
  { name: "deeplink-stale", path: `/${FAKE.hbl}`, prepare: (page) => mockTrack(page, trackData("stale")) },
  { name: "deeplink-ambiguous", path: `/${FAKE.domestic}`, prepare: (page) => mockTrack(page, trackData("ambiguous")) },
  // S06: INVALID deep link — server-rendered form with the error, no API call
  { name: "deeplink-invalid", path: `/${FAKE.deepLinkInvalid}` },
  // S07: result rows the earlier scenarios do not show (the 1024 and 1440 px shots show the desktop two-column result).
  {
    name: "deeplink-customsCleared",
    path: `/${trackData("customsCleared").trackingNumber}`,
    prepare: (page) => mockTrack(page, trackData("customsCleared"))
  },
  {
    name: "deeplink-pickedUp",
    path: `/${trackData("pickedUp").trackingNumber}`,
    prepare: (page) => mockTrack(page, trackData("pickedUp"))
  },
  {
    name: "deeplink-lookupUnavailable",
    path: `/${trackData("lookupUnavailableCarrier").trackingNumber}`,
    prepare: (page) => mockTrack(page, trackData("lookupUnavailableCarrier"))
  },
  {
    name: "deeplink-chooseCarrier",
    path: `/${trackData("lookupUnavailableAuto").trackingNumber}`,
    prepare: (page) => mockTrack(page, trackData("lookupUnavailableAuto"))
  },
  {
    name: "deeplink-carrierCut",
    path: `/${trackData("customsWithCarrierCut").trackingNumber}`,
    prepare: (page) => mockTrack(page, trackData("customsWithCarrierCut"))
  },
  {
    // Overdue: the tool pins FIXTURE_NOW first; this scenario moves the page clock past the worry date (9/29, KST).
    name: "deeplink-overdue",
    path: `/${FAKE.hbl}`,
    prepare: async (page) => {
      await page.clock.setFixedTime(new Date("2026-09-29T09:00:00+09:00"));
      await mockTrack(page, customsWaitingData());
    }
  },
  // S08: the two new screen styles, chosen before the page loads like a returning customer's stored choice.
  { name: "home-manifest", path: "/", prepare: (page) => page.addInitScript(() => window.localStorage.setItem("tt:style", "manifest")) },
  { name: "home-night", path: "/", prepare: (page) => page.addInitScript(() => window.localStorage.setItem("tt:style", "night")) },
  {
    name: "deeplink-inTransit-manifest",
    path: `/${FAKE.hbl}`,
    prepare: async (page) => {
      await page.addInitScript(() => window.localStorage.setItem("tt:style", "manifest"));
      await mockTrack(page, trackData("inTransit"));
    }
  },
  {
    name: "deeplink-inTransit-night",
    path: `/${FAKE.hbl}`,
    prepare: async (page) => {
      await page.addInitScript(() => window.localStorage.setItem("tt:style", "night"));
      await mockTrack(page, trackData("inTransit"));
    }
  }
];

/** The pre-S01 example buttons and help line showed real shipments; mask them so no real number reaches a screenshot. */
function legacyExampleMasks(page: Page): Locator[] {
  return [page.getByRole("button", { name: /^예시 / }), page.getByText(/예\) \d/)];
}

async function blockThirdParty(page: Page): Promise<void> {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

test.describe("stage screens", () => {
  test.skip(!SHOTS_ENABLED, "stage screens run only with PW_SHOTS=before|after");
  test.describe.configure({ mode: "parallel" });

  for (const scenario of SCENARIOS) {
    for (const width of WIDTHS) {
      test(`${scenario.name} @ ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.clock.setFixedTime(FIXTURE_NOW);
        await blockThirdParty(page);
        if (scenario.prepare) await scenario.prepare(page);
        await page.goto(scenario.path);
        await settle(page);
        await page.screenshot({
          path: `${OUTPUT_DIR}/${scenario.name}-${width}.png`,
          fullPage: true,
          animations: "disabled",
          mask: legacyExampleMasks(page)
        });
      });
    }
  }
});
