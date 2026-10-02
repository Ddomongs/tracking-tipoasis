import { expect, test, type APIResponse } from "@playwright/test";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";
import { FAKE } from "../fixtures/tracking-fixtures";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";

function expectSiteWideHeaders(response: APIResponse, referrerPolicy: string): void {
  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe(referrerPolicy);
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["strict-transport-security"]).toContain("includeSubDomains");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["content-security-policy-report-only"]).toContain("default-src 'self'");
  expect(headers["x-powered-by"]).toBeUndefined();
}

test.describe("public responses", () => {
  for (const pathname of ["/", "/privacy", "/guide", "/guide/faq"]) {
    test(`${pathname} has the site-wide headers and stays indexable`, async ({ request }) => {
      const response = await request.get(pathname);
      expect(response.status()).toBe(200);
      expectSiteWideHeaders(response, "strict-origin");
      expect(response.headers()["x-robots-tag"]).toBeUndefined();
    });
  }

  for (const route of [
    { name: "domestic", path: `/${FAKE.domestic}` },
    { name: "HBL", path: `/${FAKE.hbl}` }
  ] as const) {
    test(`a ${route.name} number route is noindex`, async ({ request }) => {
      const response = await request.get(route.path);
      expect(response.status()).toBe(200);
      expectSiteWideHeaders(response, "strict-origin");
      expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    });
  }

  test("the tracking API answers with the site-wide headers too", async ({ request }) => {
    const response = await request.post("/api/track", { data: { trackingNumber: FAKE.invalidShort, carrierCode: "AUTO" } });
    expect(response.status()).toBe(400);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-robots-tag"]).toBeUndefined();
  });
});

test.describe("internal responses", () => {
  test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

  test("/internal/cs-helper is noindex and sends no referrer", async ({ request }) => {
    const response = await request.get("/internal/cs-helper");
    expect(response.status()).toBe(200);
    expectSiteWideHeaders(response, "no-referrer");
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  });

  test("/internal/cs-helper is never stored by caches", async ({ request }) => {
    test.skip(!IS_PRODUCTION_RUN, "next dev overrides Cache-Control on pages");
    const response = await request.get("/internal/cs-helper");
    expect(response.headers()["cache-control"]).toContain("no-store");
  });
});
