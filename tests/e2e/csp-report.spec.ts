import { expect, test } from "@playwright/test";
import { CSP_REPORT_PATH } from "@/lib/security/csp-report";
import { FAKE, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { assertNoTrackingValues, captureThirdParty, waitForIdle } from "../support/network-capture";

const REPORT_ONLY = "content-security-policy-report-only";

test.describe("CSP Report-Only collection (S11)", () => {
  test("public pages report to the endpoint; number routes keep the policy without a report address", async ({ request }) => {
    for (const path of ["/", "/privacy"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()[REPORT_ONLY], path).toContain(`report-uri ${CSP_REPORT_PATH}`);
    }
    for (const path of [`/${FAKE.domestic}`, `/${FAKE.hbl}`, `/${FAKE.deepLinkInvalid}`]) {
      const response = await request.get(path);
      const policy = response.headers()[REPORT_ONLY] ?? "";
      expect(policy, path).toContain("default-src 'self'");
      expect(policy, path).not.toContain("report-uri");
    }
  });

  test("the endpoint answers 204 with no body to any report and has no GET", async ({ request }) => {
    const report = {
      "csp-report": {
        "document-uri": `http://127.0.0.1:43210/${FAKE.domestic}`,
        "effective-directive": "script-src-elem",
        "blocked-uri": "inline"
      }
    };
    const valid = await request.post(CSP_REPORT_PATH, {
      headers: { "content-type": "application/csp-report" },
      data: JSON.stringify(report)
    });
    expect(valid.status()).toBe(204);
    expect(await valid.text()).toBe("");
    const garbage = await request.post(CSP_REPORT_PATH, { headers: { "content-type": "application/csp-report" }, data: "{not json" });
    expect(garbage.status()).toBe(204);
    const foreign = await request.post(CSP_REPORT_PATH, { headers: { "content-type": "text/plain" }, data: "hello" });
    expect(foreign.status()).toBe(204);
    expect((await request.get(CSP_REPORT_PATH)).status()).toBe(405);
  });

  test("every report the browser sends around a deep link is free of tracking values", async ({ page }) => {
    const capture = await captureThirdParty(page);
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
    await page.goto(`/${FAKE.domestic}`);
    await expect(page.locator("[data-result-view] [data-guide-key]")).toBeVisible();
    await waitForIdle(page);
    await page.goto("/");
    await waitForIdle(page);
    const reports = capture.requests().filter((request) => new URL(request.url).pathname === CSP_REPORT_PATH);
    assertNoTrackingValues(reports);
  });
});
