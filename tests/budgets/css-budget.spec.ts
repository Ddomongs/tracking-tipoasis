import { gzipSync } from "node:zlib";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { FAKE } from "../fixtures/tracking-fixtures";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";

/** Spec §12: CSS ≤ 25 KB — gzip -9 per stylesheet, summed, 1 KB = 1024 B (S08 Addition 10; the S07 JS-budget basis). */
const CSS_BUDGET_BYTES = 25 * 1024;
const LINK_TAG = /<link\b[^>]*>/g;

interface CssSize {
  readonly files: number;
  readonly raw: number;
  readonly gzip: number;
}

function stylesheetHrefs(html: string): readonly string[] {
  const hrefs = (html.match(LINK_TAG) ?? [])
    .filter((tag) => /\brel="stylesheet"/.test(tag))
    .map((tag) => /\bhref="([^"]+)"/.exec(tag)?.[1])
    .filter((href): href is string => href !== undefined);
  return [...new Set(hrefs)];
}

async function cssSize(request: APIRequestContext, path: string): Promise<CssSize> {
  const document = await request.get(path);
  expect(document.status(), path).toBe(200);
  const hrefs = stylesheetHrefs(await document.text());
  expect(hrefs.length, `${path}: stylesheets in the server HTML`).toBeGreaterThan(0);
  let raw = 0;
  let gzip = 0;
  for (const href of hrefs) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
    const body = await response.body();
    raw += body.length;
    gzip += gzipSync(body, { level: 9 }).length;
  }
  return { files: hrefs.length, raw, gzip };
}

test.describe("CSS budget (S08)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");

  for (const route of [
    { name: "'/'", path: "/" },
    { name: "'/{번호}'", path: `/${FAKE.domestic}` },
    { name: "'/privacy'", path: "/privacy" }
  ] as const) {
    test(`${route.name}: stylesheets stay within 25 KB (gzip -9)`, async ({ request }) => {
      const size = await cssSize(request, route.path);
      console.info(`[css-budget] ${route.name}: ${size.gzip} B gzip -9, ${size.raw} B raw, ${size.files} file(s) (max ${CSS_BUDGET_BYTES} B)`);
      expect(size.gzip).toBeLessThanOrEqual(CSS_BUDGET_BYTES);
    });
  }
});
