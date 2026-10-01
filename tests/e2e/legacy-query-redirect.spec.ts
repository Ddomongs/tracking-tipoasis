import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { APIResponse } from "@playwright/test";
import { FAKE, FAKE_GROUPED, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";

// The fixtures' dates: on a later real day these results turn overdue and the return link is withheld, so pin the clock.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
});

const RESULT_READY = { name: "다시 볼 링크 복사" } as const;

function locationOf(response: APIResponse): URL {
  const location = response.headers()["location"];
  expect(location, "Location header").toBeTruthy();
  return new URL(location, "http://127.0.0.1:43210");
}

test("'/?trackingNumber=X' answers 307 to '/X'", async ({ request }) => {
  const response = await request.get(`/?trackingNumber=${FAKE.domestic}`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(locationOf(response).pathname).toBe(`/${FAKE.domestic}`);
});

test("the carrier query travels along", async ({ request }) => {
  const response = await request.get(`/?trackingNumber=${FAKE.hbl}&c=CJ`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  const target = locationOf(response);
  expect(target.pathname).toBe(`/${FAKE.hbl}`);
  expect(target.searchParams.get("c")).toBe("CJ");
});

test("grouped digits with spaces or hyphens still redirect", async ({ request }) => {
  for (const value of [FAKE_GROUPED.domestic, FAKE_GROUPED.domestic.replaceAll(" ", "-")]) {
    const response = await request.get(`/?trackingNumber=${encodeURIComponent(value)}`, { maxRedirects: 0 });
    expect(response.status(), value).toBe(307);
    expect(decodeURIComponent(locationOf(response).pathname), value).toBe(`/${value}`);
  }
});

test("surrounding spaces or a pasted newline (a form sent before hydration) still redirect to the trimmed number", async ({
  request
}) => {
  for (const raw of [`%20${FAKE.domestic}`, `${FAKE.domestic}%0A`, `%20%20${FAKE.hbl}%20`]) {
    const response = await request.get(`/?carrierCode=AUTO&trackingNumber=${raw}`, { maxRedirects: 0 });
    expect(response.status(), raw).toBe(307);
    const expected = raw.includes(FAKE.hbl) ? FAKE.hbl : FAKE.domestic;
    expect(locationOf(response).pathname, raw).toBe(`/${expected}`);
  }
  const reserved = await request.get("/?trackingNumber=%20internal%20", { maxRedirects: 0 });
  expect(reserved.status()).toBe(200);
});

test("unsafe or empty values are not redirected: no open redirect, no 500", async ({ request }) => {
  for (const raw of ["", "%20", "%2F%2Fexample.com", "abc.def", "%ED%95%9C", "internal", "api", "privacy"]) {
    const response = await request.get(`/?trackingNumber=${raw}`, { maxRedirects: 0 });
    expect(response.status(), raw).toBe(200);
    expect(response.headers()["location"], raw).toBeUndefined();
  }
});

test("a legacy link ends on '/' with the lookup and no number left in the URL", async ({ page }) => {
  await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
  await page.goto(`/?trackingNumber=${FAKE.domestic}`);
  await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => `${location.pathname}${location.search}${location.hash}`), { timeout: 10_000 })
    .toBe("/");
});

test("'/' stays static: its page never reads searchParams", () => {
  const source = readFileSync(path.join(process.cwd(), "app", "(public)", "page.tsx"), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  expect(code).not.toContain("searchParams");
});
