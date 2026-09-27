import { expect, test, type Page } from "@playwright/test";
import { STYLE_IDS, STYLE_STORAGE_KEY, type StyleId } from "@/lib/style/styles";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, FIXTURE_NOW, mockTrack, trackData, type FailureFixture } from "../fixtures/tracking-fixtures";

/**
 * Visual regression matrix (spec §13 "품질 비용"): the eight Phase 3 canvas screens × 375 / 1440 px × three styles = 48.
 * Runs only with PW_VISUAL=1 (roadmap §11.10). Baselines live in tests/visual/style-matrix.spec.ts-snapshots/.
 */
const VISUAL = process.env.PW_VISUAL === "1";
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1440, height: 900 }
] as const;

interface MatrixState {
  readonly name: string;
  readonly path: string;
  readonly reply: TrackResponseData | FailureFixture | null;
  /** Visible once the state is on screen. */
  readonly ready: string;
  readonly loading?: boolean;
}

const STATES: readonly MatrixState[] = [
  { name: "home", path: "/", reply: null, ready: '[data-view-state="idle"]' },
  {
    name: "loading",
    path: `/${FAKE.domestic}`,
    reply: trackData("inTransit", { trackingNumber: FAKE.domestic }),
    ready: '[data-loading-stage="short"]',
    loading: true
  },
  { name: "pending", path: `/${FAKE.domestic}`, reply: trackData("pending", { trackingNumber: FAKE.domestic }), ready: '[data-result-view="settled"]' },
  { name: "customsWaiting", path: `/${FAKE.hbl}`, reply: trackData("customsWaiting", { trackingNumber: FAKE.hbl }), ready: '[data-result-view="settled"]' },
  { name: "inTransit", path: `/${FAKE.domestic}`, reply: trackData("inTransit", { trackingNumber: FAKE.domestic }), ready: '[data-result-view="settled"]' },
  { name: "delivered", path: `/${FAKE.domestic}`, reply: trackData("delivered", { trackingNumber: FAKE.domestic }), ready: '[data-result-view="settled"]' },
  { name: "stale", path: `/${FAKE.domestic}`, reply: trackData("stale", { trackingNumber: FAKE.domestic }), ready: '[data-result-view="settled"]' },
  { name: "notFound", path: `/${FAKE.domestic}`, reply: "notFound404", ready: '[data-result-view="error"]' }
];

async function prepare(page: Page, style: StyleId, state: MatrixState): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [STYLE_STORAGE_KEY, style] as const
  );
  if (state.loading === true) {
    // Fake timers: the card is held at the short stage (0.4–3 s) however slow the machine is.
    await page.clock.install({ time: FIXTURE_NOW });
  } else {
    await page.clock.setFixedTime(FIXTURE_NOW);
  }
  if (state.reply !== null) await mockTrack(page, state.reply, state.loading === true ? { delayMs: 120_000 } : undefined);
}

test.describe("style matrix (S08)", () => {
  test.skip(!VISUAL, "the visual matrix runs only with PW_VISUAL=1");
  test.describe.configure({ mode: "parallel" });

  for (const style of STYLE_IDS) {
    for (const viewport of VIEWPORTS) {
      for (const state of STATES) {
        test(`${state.name} · ${style} · ${viewport.width}`, async ({ page }) => {
          await page.setViewportSize(viewport);
          await prepare(page, style, state);
          const lookupStarted = state.loading === true ? page.waitForRequest("**/api/track") : null;
          await page.goto(state.path);
          if (lookupStarted !== null) {
            // The lookup has started (after hydration): move the fake clock into the short stage and keep it there.
            await lookupStarted;
            await page.clock.runFor(1_000);
          }
          await expect(page.locator(state.ready)).toBeVisible();
          await expect(page.locator("html")).toHaveAttribute("data-style", style);
          if (state.loading !== true) await page.waitForLoadState("networkidle");
          await page.evaluate(async () => {
            await document.fonts.ready;
          });
          await expect(page).toHaveScreenshot(`${state.name}-${style}-${viewport.width}.png`, {
            fullPage: true,
            animations: "disabled",
            maxDiffPixelRatio: 0.01
          });
        });
      }
    }
  }
});
