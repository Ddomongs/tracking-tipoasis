import { expect, test } from "@playwright/test";

/** Ad and analytics hosts: tests must never reach them (automated ad traffic breaks the publisher policy). */
const AD_HOST = /(^|\.)(googlesyndication\.com|doubleclick\.net|adtrafficquality\.google|google-analytics\.com|googletagmanager\.com)$/;

test("the test browser never completes a request to an ad host", async ({ page }) => {
  const reached: string[] = [];
  page.on("requestfinished", (request) => {
    const host = new URL(request.url()).hostname;
    if (AD_HOST.test(host)) reached.push(host);
  });

  await page.goto("/");
  await page.waitForLoadState("load");
  // next/script lazyOnload inserts the AdSense loader after load plus an idle period.
  await page.waitForTimeout(3000);

  expect(reached).toEqual([]);
});
