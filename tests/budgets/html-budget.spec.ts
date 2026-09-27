import { expect, test } from "@playwright/test";
import { FAKE } from "../fixtures/tracking-fixtures";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";

/** Spec §12: '/' HTML ≤ 35 KB (109,852 B before the renewal), served from the static cache (CDN HIT on Vercel). */
const HTML_BUDGET_BYTES = 35 * 1024;

test.describe("HTML budget (S06)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");

  test("'/' HTML is at most 35 KB and comes from the 5-minute static cache", async ({ request }) => {
    const response = await request.get("/");
    expect(response.status()).toBe(200);
    const bytes = (await response.body()).byteLength;
    console.info(`[html-budget] '/': ${bytes} B (max ${HTML_BUDGET_BYTES} B)`);
    expect(bytes).toBeLessThanOrEqual(HTML_BUDGET_BYTES);
    expect(response.headers()["cache-control"] ?? "").toContain("s-maxage=300");
  });

  test("the deep-link shell size is reported for the stage summary", async ({ request }) => {
    const response = await request.get(`/${FAKE.domestic}`);
    expect(response.status()).toBe(200);
    console.info(`[html-budget] '/{번호}': ${(await response.body()).byteLength} B (reported, no limit)`);
  });
});
