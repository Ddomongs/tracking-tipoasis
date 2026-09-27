import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { STATUS_SLOT_APPROVALS, deriveStatusView } from "@/components/status-slot/status-view";
import { INVALID_NUMBER_ERROR_ID } from "@/components/lookup/LookupForm";
import { lookup, siteConfig } from "@/config/site.config";
import type { ActionKind, FailureCause, TrackingViewModel } from "@/lib/tracking/types";
import { FAILURE_RESPONSES, FAKE, FIXTURE_NOW, mockTrack, successBody, trackData } from "../fixtures/tracking-fixtures";
import type { FailureFixture } from "../fixtures/tracking-fixtures";
import {
  INPUT_LABEL,
  PAUSED_NOW,
  actionControl,
  actionName,
  blockThirdParty,
  holdTrack,
  lookUp,
  manualRequest,
  openPaused,
  statusSlot
} from "../support/status-slot";

const CAUSE_BY_FIXTURE: Readonly<Record<FailureFixture, FailureCause>> = {
  invalid400: "invalidNumber",
  notFound404: "notFound",
  rateLimited429: "rateLimited",
  upstreamTimeout504: "upstreamTimeout",
  unavailable503: "upstreamTimeout",
  serverError500: "serverError",
  badGatewayHtml502: "badGateway",
  contractViolation200: "contractViolation"
};
/** Negative checks: time for a wrongly started request to show up. */
const SETTLE_MS = 500;

function expectedFailure(cause: FailureCause, number: string, now: Date = FIXTURE_NOW, consecutiveFailures = 1): TrackingViewModel {
  return deriveStatusView({ kind: "failure", request: manualRequest(number), cause, consecutiveFailures }, now);
}

/** The server's own sentence in a failure fixture (never shown to customers), or null when the body has none. */
function serverMessageOf(fixture: FailureFixture): string | null {
  try {
    const body: unknown = JSON.parse(FAILURE_RESPONSES[fixture].body);
    if (typeof body !== "object" || body === null || !("error" in body)) return null;
    const error: unknown = body.error;
    if (typeof error !== "object" || error === null || !("message" in error)) return null;
    return typeof error.message === "string" ? error.message : null;
  } catch {
    return null;
  }
}

async function setNavigatorOnline(page: Page, online: boolean): Promise<void> {
  await page.evaluate((value) => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value });
  }, online);
}

async function dispatchOnline(page: Page): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
}

test.beforeEach(async ({ page }) => {
  await blockThirdParty(page);
});

// S06: a server INVALID answer is shown at the input, not in the slot; its test follows this loop (RULE-MAP S2).
for (const fixture of (Object.keys(CAUSE_BY_FIXTURE) as FailureFixture[]).filter((key) => key !== "invalid400")) {
  test(`${fixture}: the cause's own notice, 톡톡 first in the block, no stores and no server wording`, async ({ page }) => {
    const cause = CAUSE_BY_FIXTURE[fixture];
    const view = expectedFailure(cause, FAKE.domestic);
    await page.clock.setFixedTime(FIXTURE_NOW);
    await mockTrack(page, fixture);
    await page.goto("/");
    await lookUp(page, FAKE.domestic);

    const slot = statusSlot(page);
    await expect(slot).toHaveAttribute("data-view-state", "error");
    const notice = slot.locator(`[data-failure-cause="${cause}"]`);
    await expect(notice).toHaveAttribute("data-guide-key", view.guideKey);
    if (view.guideKey === "invalidNumber") {
      await expect(notice.getByRole("alert")).toHaveText(view.title);
      await expect(notice.getByRole("heading")).toHaveCount(0);
    } else {
      const heading = notice.getByRole("heading", { level: 2 });
      await expect(heading).toHaveText(view.title);
      await expect(heading).toBeFocused();
      await expect(heading).not.toHaveAttribute("role", "alert");
      // S07: errors are announced through the live region, not role=alert (RULE-MAP S07-12)
      await expect(notice.getByText(view.reason ?? "", { exact: true })).toHaveText(view.reason ?? "");
    }

    const cta = slot.locator('[data-cta-state="error"]');
    await expect(cta.getByRole("heading", { level: 3 })).toHaveText(view.nextAction.heading ?? "");
    await expect(cta.getByRole("link").first()).toHaveAttribute("href", siteConfig.channels.talk.url);
    await expect(slot.locator('[data-slot="button"][data-variant="primary"]')).toHaveCount(1);
    await expect(page.locator('a[rel~="sponsored"]')).toHaveCount(0);
    await expect(page.locator("[data-affiliate-group], [data-recommended-products], [data-storefront-showcase]")).toHaveCount(0);
    const message = serverMessageOf(fixture);
    if (message !== null) await expect(page.getByText(message)).toHaveCount(0);
  });
}

test("invalid400 (S06): a server INVALID answer reopens the form with the error at the input, 톡톡 first in the error block", async ({ page }) => {
  const view = expectedFailure("invalidNumber", FAKE.domestic);
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, "invalid400");
  await page.goto("/");
  await lookUp(page, FAKE.domestic);
  await expect(page.locator('[data-view-state="error"]')).toHaveCount(1);
  const block = page.locator('[data-guide-key="invalidNumber"]');
  await expect(block.getByRole("alert")).toHaveText(view.title);
  await expect(block.getByRole("heading")).toHaveCount(0);
  await expect(page.getByLabel(INPUT_LABEL, { exact: true })).toBeFocused();
  const cta = page.locator('[data-cta-state="error"]');
  await expect(cta.getByRole("heading", { level: 3 })).toHaveText(view.nextAction.heading ?? "");
  await expect(cta.getByRole("link").first()).toHaveAttribute("href", siteConfig.channels.talk.url);
  // The form's [조회하기] is the one filled button of the INVALID screen (Open issue 5).
  await expect(page.locator('[data-slot="button"][data-variant="primary"]')).toHaveCount(1);
  await expect(page.locator('a[rel~="sponsored"]')).toHaveCount(0);
  await expect(page.locator("[data-affiliate-group], [data-recommended-products], [data-storefront-showcase]")).toHaveCount(0);
  const message = serverMessageOf("invalid400");
  if (message !== null) await expect(page.getByText(message)).toHaveCount(0);
});

test("an invalid number keeps focus in the input and describes the error there", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, "invalid400");
  await page.goto("/");
  await lookUp(page, FAKE.deepLinkInvalid);
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  expect(((await input.getAttribute("aria-describedby")) ?? "").split(" ")).toContain(INVALID_NUMBER_ERROR_ID);
  const sentence = page.locator(`#${INVALID_NUMBER_ERROR_ID}`);
  await expect(sentence).toHaveText(expectedFailure("invalidNumber", FAKE.deepLinkInvalid).title);
  await expect(sentence).toHaveAttribute("role", "alert");
});

test("[번호 수정] puts the cursor back in the number field with the number selected", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, "notFound404");
  await page.goto("/");
  await lookUp(page, FAKE.domestic);
  await actionControl(statusSlot(page), expectedFailure("notFound", FAKE.domestic), "fixNumber").click();
  const input = page.getByLabel(INPUT_LABEL, { exact: true });
  await expect(input).toBeFocused();
  const selected = await input.evaluate((element) =>
    element instanceof HTMLInputElement ? (element.selectionEnd ?? 0) - (element.selectionStart ?? 0) : -1
  );
  expect(selected).toBe(FAKE.domestic.length);
});

test("the filled primary on an error follows the approval-3 ledger", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, "notFound404");
  await page.goto("/");
  await lookUp(page, FAKE.domestic);
  const view = expectedFailure("notFound", FAKE.domestic);
  expect(view.nextAction.primary?.kind).toBe(STATUS_SLOT_APPROVALS.approval3 ? "fixNumber" : "talk");
  await expect(statusSlot(page).locator('[data-slot="button"][data-variant="primary"]')).toHaveAccessibleName(
    actionName(view, view.nextAction.primary?.kind ?? "none")
  );
});

test("NOT_FOUND shows the service caveat line only while lookup.notFoundServiceCaveat is on", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, "notFound404");
  await page.goto("/");
  await lookUp(page, FAKE.domestic);
  await expect(statusSlot(page).locator('[data-failure-cause="notFound"]')).toBeVisible();
  await expect(statusSlot(page).getByText(siteConfig.resultCopy.notFoundCaveat)).toHaveCount(lookup.notFoundServiceCaveat ? 1 : 0);
});

test("429: [다시 조회] waits out the countdown, then looks up again; nothing retries by itself", async ({ page }) => {
  const bodies: unknown[] = [];
  await mockTrack(page, "rateLimited429", { onRequest: (body) => bodies.push(body) });
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  const slot = statusSlot(page);
  const view = expectedFailure("rateLimited", FAKE.domestic, PAUSED_NOW);
  // S07: errors are announced through the live region, not role=alert (RULE-MAP S07-12)
  await expect(slot.locator('[data-failure-cause="rateLimited"]').getByText(view.reason ?? "", { exact: true })).toHaveText(
    view.reason ?? ""
  );
  const retry = actionControl(slot, view, "retry");
  await expect(retry).toHaveAttribute("aria-disabled", "true");
  await retry.click({ force: true });
  await page.clock.runFor(1_000);
  expect(bodies).toHaveLength(1);
  await page.clock.runFor(lookup.rateLimitCooldownSeconds * 1000);
  await expect(retry).not.toHaveAttribute("aria-disabled", "true");
  await retry.click();
  await expect.poll(() => bodies.length).toBe(2);
});

test("a network error while online is a temporary delay, not a number problem", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await page.route("**/api/track", (route) => (route.request().method() === "POST" ? route.abort("failed") : route.fallback()));
  await page.goto("/");
  await lookUp(page, FAKE.domestic);
  const notice = statusSlot(page).locator('[data-failure-cause="network"]');
  await expect(notice).toHaveAttribute("data-guide-key", "temporaryDelay");
  const reason = expectedFailure("network", FAKE.domestic).reason ?? "";
  // S07: errors are announced through the live region, not role=alert (RULE-MAP S07-12)
  await expect(notice.getByText(reason, { exact: true })).toHaveText(reason);
});

test("offline: one automatic re-lookup when the connection returns", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const bodies: unknown[] = [];
  let reachable = false;
  await page.route("**/api/track", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    bodies.push(route.request().postDataJSON());
    if (!reachable) {
      await route.abort("internetdisconnected");
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: successBody(trackData("inTransit")) });
  });
  await page.goto("/");
  await setNavigatorOnline(page, false);
  await lookUp(page, FAKE.hbl);
  const notice = statusSlot(page).locator('[data-failure-cause="offline"]');
  await expect(notice.getByRole("heading", { level: 2 })).toHaveText(expectedFailure("offline", FAKE.hbl).title);
  expect(bodies).toHaveLength(1);
  reachable = true;
  await setNavigatorOnline(page, true);
  await dispatchOnline(page);
  await expect(statusSlot(page).locator('[data-guide-key="inTransit"]')).toBeVisible();
  expect(bodies).toHaveLength(2);
});

test("offline: the automatic re-lookup happens once, never a second time in a row", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  const bodies: unknown[] = [];
  await page.route("**/api/track", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    bodies.push(route.request().postDataJSON());
    await route.abort("internetdisconnected");
  });
  await page.goto("/");
  await setNavigatorOnline(page, false);
  await lookUp(page, FAKE.hbl);
  await expect(statusSlot(page).locator('[data-failure-cause="offline"]')).toBeVisible();
  // The connection flaps: "online" fires, but the automatic re-lookup fails offline again.
  await dispatchOnline(page);
  await expect.poll(() => bodies.length).toBe(2);
  await expect(statusSlot(page).locator('[data-failure-cause="offline"]')).toBeVisible();
  await dispatchOnline(page);
  await page.waitForTimeout(SETTLE_MS);
  expect(bodies).toHaveLength(2);
});

test("a second failure in a row makes [문의 내용 복사하고 톡톡 열기] the filled primary with the inquiry text", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, "upstreamTimeout504");
  await page.goto("/");
  await lookUp(page, FAKE.domestic);
  const slot = statusSlot(page);
  await expect(slot.locator('[data-failure-cause="upstreamTimeout"]')).toBeVisible();
  await actionControl(slot, expectedFailure("upstreamTimeout", FAKE.domestic), "retry").click();
  const view = deriveStatusView(
    { kind: "failure", request: { ...manualRequest(FAKE.domestic), entry: "retry" }, cause: "upstreamTimeout", consecutiveFailures: 2 },
    FIXTURE_NOW
  );
  const primary = slot.locator('[data-slot="button"][data-variant="primary"]');
  await expect(primary).toHaveAccessibleName(actionName(view, "copyAndTalk"));
  await expect(primary).toHaveAccessibleName(`${view.nextAction.primary?.label ?? ""} 새 창으로 열기`);
  await expect(slot.locator("[data-inquiry-preview]")).toHaveText(view.inquiryCopy ?? "");
  await expect(slot.locator('[data-cta-state="error"]').getByRole("link").first()).toHaveAccessibleName(actionName(view, "copyAndTalk"));
});

test("the client timeout stops the lookup and does not blame the number", async ({ page }) => {
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await page.clock.runFor(lookup.timeoutMs);
  const view = expectedFailure("clientTimeout", FAKE.domestic, PAUSED_NOW);
  const notice = statusSlot(page).locator('[data-failure-cause="clientTimeout"]');
  await expect(notice).toHaveAttribute("data-guide-key", "noResponse");
  const heading = notice.getByRole("heading", { level: 2 });
  await expect(heading).toHaveText(view.title);
  await expect(heading).toBeFocused();
  // S07: errors are announced through the live region, not role=alert (RULE-MAP S07-12)
  const reason = notice.getByText(view.reason ?? "", { exact: true });
  await expect(reason).toHaveText(view.reason ?? "");
  await expect(reason).not.toContainText("번호 문제는 아니에요");
});

/** Spec §16 item 3 as approved, with the §7 rows: the failure card leads with the cause's own recovery action. */
const APPROVED_PRIMARY: Readonly<Record<FailureFixture, ActionKind>> = {
  invalid400: "fixNumber",
  notFound404: "fixNumber",
  rateLimited429: "retry",
  upstreamTimeout504: "retry",
  unavailable503: "retry",
  serverError500: "copyAndTalk",
  badGatewayHtml502: "retry",
  contractViolation200: "copyAndTalk"
};

for (const fixture of (Object.keys(APPROVED_PRIMARY) as FailureFixture[]).filter((key) => key !== "invalid400")) {
  test(`${fixture} (approval 3): the recovery action leads and 톡톡 stays the first link of the block`, async ({ page }) => {
    const cause = CAUSE_BY_FIXTURE[fixture];
    const kind = APPROVED_PRIMARY[fixture];
    const view = expectedFailure(cause, FAKE.domestic);
    expect(view.nextAction.primary?.kind).toBe(kind);
    await page.clock.setFixedTime(FIXTURE_NOW);
    await mockTrack(page, fixture);
    await page.goto("/");
    await lookUp(page, FAKE.domestic);

    const slot = statusSlot(page);
    const primary = slot.locator('[data-slot="button"][data-variant="primary"]');
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveAccessibleName(actionName(view, kind));
    const cta = slot.locator('[data-cta-state="error"]');
    const firstLink = cta.getByRole("link").first();
    await expect(firstLink).toHaveAttribute("href", siteConfig.channels.talk.url);
    if (kind === "copyAndTalk") {
      await expect(cta.locator('[data-slot="button"][data-variant="primary"]')).toHaveAccessibleName(actionName(view, "copyAndTalk"));
    } else {
      await expect(slot.locator(`[data-failure-cause="${cause}"] [data-slot="button"][data-variant="primary"]`)).toHaveAccessibleName(
        actionName(view, kind)
      );
      await expect(firstLink).not.toHaveAttribute("data-variant", "primary");
    }
  });
}

test("client timeout (approval 3): the row's recovery action leads the card, the other follows, 톡톡 stays the first link", async ({ page }) => {
  // Spec §7 'error · 응답 없음': 주 행동 [다시 조회], 보조 [번호 수정] — S03 ships noResponse.primaryAction "retry". §16 item 3's
  // proposal names [번호 수정] for 응답 없음; if the operator's approval-3 decision says so, S03's follow-up sets the row to
  // "fixNumber" and the two swap here without a test edit. (Typed as string: the config literal type would make the comparison fail tsc.)
  const lead: string = siteConfig.stateGuide.noResponse.primaryAction;
  const follow = lead === "fixNumber" ? "retry" : "fixNumber";
  const held = await holdTrack(page);
  await openPaused(page);
  await lookUp(page, FAKE.domestic);
  await held.waitForRequests(1);
  await page.clock.runFor(lookup.timeoutMs);
  const view = expectedFailure("clientTimeout", FAKE.domestic, PAUSED_NOW);
  expect(view.nextAction.primary?.kind).toBe(lead);
  const notice = statusSlot(page).locator('[data-failure-cause="clientTimeout"]');
  await expect(notice.locator('[data-slot="button"][data-variant="primary"]')).toHaveAccessibleName(actionName(view, lead));
  await expect(actionControl(notice, view, follow)).toHaveAttribute("data-variant", "secondary");
  await expect(statusSlot(page).locator('[data-cta-state="error"]').getByRole("link").first()).toHaveAttribute(
    "href",
    siteConfig.channels.talk.url
  );
});
