import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { INTERNAL_TEST_CREDENTIALS } from "./internal-auth";
import { MISMATCH_LEGACY_KEY } from "@/lib/cs/mismatch-storage";
import { siteConfig } from "@/config/site.config";
import { buildCsReply } from "@/lib/cs/cs-reply";
import type { CsReply } from "@/lib/cs/cs-reply";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import type { LookupOutcome } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";
import { FAKE, mockTrack } from "./fixtures/tracking-fixtures";

test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

/** The helper judges stale and overdue with the staff member's clock, like the customer page: pin it to the fixtures' day. */
const CS_NOW = new Date("2026-05-31T12:00:00+09:00");
const CS_REQUEST = { number: FAKE.domestic, carrier: "AUTO", entry: "manual" } as const;

const IN_TRANSIT: TrackResponseData = {
  trackingNumber: FAKE.domestic,
  type: "DOMESTIC",
  currentStatus: "배송중",
  currentStatusCode: 6,
  customs: { events: [] },
  delivery: {
    carrier: "CJ대한통운",
    carrierCode: "CJ",
    invoiceNumber: FAKE.domestic,
    events: [
      { status: "배송중", statusCode: 6, datetime: "2026-05-31T08:30:00.000+09:00", location: "인천허브", detail: "간선상차" }
    ]
  },
  timeline: [],
  lastUpdated: "2026-05-31T08:30:00.000+09:00"
};

const PENDING: TrackResponseData = {
  trackingNumber: FAKE.domestic,
  type: "DOMESTIC",
  currentStatus: "도착전",
  currentStatusCode: 1,
  isPending: true,
  customs: { events: [] },
  delivery: { carrier: "CJ대한통운", carrierCode: "CJ", invoiceNumber: FAKE.domestic, events: [] },
  timeline: [],
  lastUpdated: "2026-05-31T08:30:00.000+09:00"
};

/** What the helper must show: buildCsReply over the same view model the customer page derives (spec §10). */
function expectedReply(outcome: LookupOutcome): CsReply {
  const view = deriveTrackingView(outcome, CS_NOW, siteConfig);
  return buildCsReply(view, { now: CS_NOW, notices: siteConfig.notices });
}

async function lookUpInHelper(page: Page): Promise<void> {
  await page.goto("/internal/cs-helper");
  await page.getByLabel("운송장번호").fill(FAKE.domestic);
  await page.getByRole("button", { name: "조회" }).click();
}

test("internal helper generates a copy-ready delivery reply from an invoice", async ({ page }) => {
  await page.clock.setFixedTime(CS_NOW);
  await mockTrack(page, IN_TRANSIT);
  await lookUpInHelper(page);

  const reply = expectedReply({ kind: "success", request: CS_REQUEST, data: IN_TRANSIT });
  await expect(page.getByText("CJ대한통운", { exact: true })).toBeVisible();
  await expect(page.getByText(FAKE.domestic).first()).toBeVisible();
  await expect(page.getByLabel("고객 안내문")).toHaveValue(reply.long);
  expect(reply.long).toContain(reply.customerLink);
  expect(reply.long).not.toMatch(/택배사 자동 확인|관리자에게/);
  await expect(page.getByRole("button", { name: "복사" })).toBeVisible();
});

test("internal helper answers pending invoices from the same view and saves nothing", async ({ page }) => {
  await page.clock.setFixedTime(CS_NOW);
  await mockTrack(page, PENDING);
  await lookUpInHelper(page);

  await expect(page.getByLabel("고객 안내문")).toHaveValue(expectedReply({ kind: "success", request: CS_REQUEST, data: PENDING }).long);
  const savedRecords = await page.evaluate((key) => window.localStorage.getItem(key), MISMATCH_LEGACY_KEY);
  expect(savedRecords).toBeNull();
});

test("internal helper turns a failed lookup into a CS reply, never the server message", async ({ page }) => {
  await page.clock.setFixedTime(CS_NOW);
  await mockTrack(page, "notFound404");
  await lookUpInHelper(page);

  const reply = expectedReply({ kind: "failure", request: CS_REQUEST, cause: "notFound", consecutiveFailures: 1 });
  await expect(page.getByLabel("고객 안내문")).toHaveValue(reply.long);
  await expect(page.getByText("해당 번호로 통관/배송 정보를 찾을 수 없습니다")).toHaveCount(0);
});
