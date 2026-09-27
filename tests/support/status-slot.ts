import type { Locator, Page, Route } from "@playwright/test";
import type { ActionView, LookupRequest, TrackingViewModel } from "@/lib/tracking/types";
import type { DeliveryCarrierCode, TrackResponseData } from "@/lib/types";
import { FAILURE_RESPONSES, FIXTURE_NOW, successBody } from "../fixtures/tracking-fixtures";
import type { FailureFixture } from "../fixtures/tracking-fixtures";

/** Helpers for the S04 status-slot E2E (S07 rewrites these specs for the R3 DOM and keeps this file for them). */

export const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
export const CARRIER_LABEL = "국내 택배사";
/** Fake time pauses this long after FIXTURE_NOW: later than any dev-server compile that ran on the still-flowing fake clock. */
export const PAUSE_OFFSET_MS = 120_000;
export const PAUSED_NOW = new Date(FIXTURE_NOW.getTime() + PAUSE_OFFSET_MS);
/** Live regions the application renders. Next.js adds its own route announcer (shadow DOM, id below) for route changes only. */
export const APP_LIVE_REGIONS = "[aria-live]:not(#__next-route-announcer__)";

export const statusSlot = (page: Page): Locator => page.locator("#tracking-panel [data-view-state]");
/** Every root ResultSlot can render (S07): an empty slot shows none of them. */
export const RESULT_SLOT_CONTENT = "[data-loading-stage], [data-result-view], [data-result-pending], [data-result-module-failure]";
export const liveRegion = (page: Page): Locator => page.locator('[data-live-region="polite"]');
export const submitButton = (page: Page): Locator => page.locator('#tracking-panel form button[type="submit"]');

/** The view's action of kind K (S07: `[data-action-kind]` is gone; the control is found by the name the view gives it). */
function actionOfKind(view: TrackingViewModel, kind: string): ActionView {
  const candidates = [
    view.nextAction.primary,
    ...view.nextAction.secondary,
    view.nextAction.worry?.talk ?? null,
    view.auxiliaryLine?.action ?? null
  ];
  const found = candidates.find((item): item is ActionView => item !== null && item.kind === kind);
  if (found === undefined) throw new Error(`the view has no action of kind "${kind}"`);
  return found;
}

/** The accessible name of the control that performs the view's action of kind K. */
export function actionName(view: TrackingViewModel, kind: string): string {
  const action = actionOfKind(view, kind);
  return action.href !== null && action.external ? `${action.label} 새 창으로 열기` : action.label;
}

/** The control of the view's action of kind K inside `scope` (replaces S04's `[data-action-kind="K"]`). */
export function actionControl(scope: Page | Locator, view: TrackingViewModel, kind: string): Locator {
  const action = actionOfKind(view, kind);
  return action.href === null
    ? scope.getByRole("button", { name: action.label, exact: true })
    : scope.getByRole("link", { name: actionName(view, kind), exact: true });
}

export function manualRequest(number: string, carrier: DeliveryCarrierCode = "AUTO"): LookupRequest {
  return { number, carrier, entry: "manual" };
}

/** Aborts every request that leaves the local server, in every page of the context (AdSense, 톡톡 and store tabs). */
export async function blockThirdParty(page: Page): Promise<void> {
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, (route) => route.abort());
}

export async function lookUp(page: Page, number: string, carrier?: DeliveryCarrierCode): Promise<void> {
  if (carrier !== undefined) await page.getByRole("combobox", { name: CARRIER_LABEL }).selectOption(carrier);
  await page.getByLabel(INPUT_LABEL, { exact: true }).fill(number);
  await submitButton(page).click();
}

/** Installs the page clock at FIXTURE_NOW, opens `path`, then pauses time so only page.clock.runFor moves clocks and timers. */
export async function openPaused(page: Page, path = "/"): Promise<void> {
  await page.clock.install({ time: FIXTURE_NOW });
  await page.goto(path);
  await page.getByLabel(INPUT_LABEL, { exact: true }).waitFor();
  await page.clock.pauseAt(PAUSED_NOW);
}

interface HeldRequest {
  readonly route: Route;
  readonly body: unknown;
}

export interface HeldTrack {
  readonly bodies: () => readonly unknown[];
  readonly waitForRequests: (count: number) => Promise<void>;
  readonly release: (index: number, response: TrackResponseData | FailureFixture) => Promise<void>;
}

/** Holds every POST /api/track until the test releases it with a canned answer (other methods fall through). */
export async function holdTrack(page: Page): Promise<HeldTrack> {
  const held: HeldRequest[] = [];
  const waiters: Array<{ readonly count: number; readonly resolve: () => void }> = [];
  await page.route("**/api/track", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const body: unknown = route.request().postDataJSON();
    held.push({ route, body });
    for (const waiter of waiters) if (held.length >= waiter.count) waiter.resolve();
  });
  return {
    bodies: () => held.map((item) => item.body),
    waitForRequests: (count) =>
      held.length >= count ? Promise.resolve() : new Promise<void>((resolve) => waiters.push({ count, resolve })),
    release: async (index, response) => {
      const item = held[index];
      if (item === undefined) throw new Error(`no held /api/track request #${index}`);
      const reply =
        typeof response === "string"
          ? FAILURE_RESPONSES[response]
          : { status: 200, contentType: "application/json", body: successBody(response) };
      try {
        await item.route.fulfill(reply);
      } catch (error) {
        // The page aborted this request (cancel or a newer submit): answering it is expected to fail.
        const abandoned =
          item.route.request().failure() !== null || (error instanceof Error && /closed|disposed|handled|abort/i.test(error.message));
        if (!abandoned) throw error;
      }
    }
  };
}
