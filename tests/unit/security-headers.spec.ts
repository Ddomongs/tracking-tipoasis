import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { modifyRouteRegex } from "next/dist/lib/redirect-status";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import nextConfig from "@/next.config";
import { PREPAINT_CSP_SOURCE } from "@/lib/style/prepaint";
import { CSP_REPORT_PATH } from "@/lib/security/csp-report";
import {
  ALL_ROUTES_SOURCE,
  INTERNAL_ROUTES_SOURCE,
  NUMBER_ROUTE_SOURCE,
  buildSecurityHeaders,
  type HeaderRule
} from "@/lib/security/headers";
import { FAKE, FAKE_GROUPED } from "../fixtures/tracking-fixtures";

const headerMap = (rule: HeaderRule | undefined): Record<string, string> =>
  Object.fromEntries((rule?.headers ?? []).map((header) => [header.key, header.value]));
const ruleFor = (source: string): HeaderRule | undefined => buildSecurityHeaders().find((rule) => rule.source === source);
/** Exactly how Next.js matches headers() sources at runtime (next/dist/server/lib/router-utils/filesystem.js). */
const matches = (source: string, pathname: string): boolean =>
  getPathMatch(source, {
    strict: true,
    removeUnnamedParams: true,
    regexModifier: (regex) => modifyRouteRegex(regex)
  })(pathname) !== false;
const directiveNames = (policy: string): string[] =>
  policy
    .split(";")
    .map((part) => part.trim().split(/\s+/)[0] ?? "")
    .filter((name) => name.length > 0);

const NUMBER_ROUTE_ROWS: ReadonlyArray<readonly [string, boolean]> = [
  [`/${FAKE.domestic}`, true],
  [`/${FAKE.hbl}`, true],
  [`/${FAKE.hbl.toLowerCase()}`, true],
  [`/${FAKE.deepLinkInvalid}`, true],
  [`/${encodeURIComponent(FAKE_GROUPED.domestic)}`, true],
  ["/0000-1234-5678", true],
  ["/", false],
  ["/privacy", false],
  ["/guide", false],
  ["/company", false],
  ["/guide/faq", false],
  ["/internal", false],
  ["/api", false],
  ["/api/track", false],
  ["/internal/cs-helper", false],
  ["/robots.txt", false],
  ["/sitemap.xml", false],
  ["/icon.svg", false],
  [`/${FAKE.domestic}/extra`, false]
];

test("three rules in override order: every route, number routes, /internal", () => {
  expect(buildSecurityHeaders().map((rule) => rule.source)).toEqual([
    ALL_ROUTES_SOURCE,
    NUMBER_ROUTE_SOURCE,
    INTERNAL_ROUTES_SOURCE
  ]);
  expect(NUMBER_ROUTE_SOURCE).toBe("/:number((?!privacy$|internal$|api$|guide$|company$)[^/.]+)");
  expect(INTERNAL_ROUTES_SOURCE).toBe("/internal/:path*");
});

test("every route gets the stage-1 security headers", () => {
  const all = headerMap(ruleFor(ALL_ROUTES_SOURCE));
  expect(all["X-Content-Type-Options"]).toBe("nosniff");
  expect(all["Referrer-Policy"]).toBe("strict-origin");
  expect(all["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  expect(all["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains");
  expect(all["Content-Security-Policy"]).toBe("base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'");
  expect(all["Content-Security-Policy-Report-Only"]).toContain("default-src 'self'");
  for (const pathname of ["/", "/privacy", "/api/track", "/robots.txt", `/${FAKE.domestic}`, "/internal/cs-helper"]) {
    expect(matches(ALL_ROUTES_SOURCE, pathname), pathname).toBe(true);
  }
});

test("the enforced CSP never limits scripts, styles, images, fonts or connections", () => {
  const enforced = headerMap(ruleFor(ALL_ROUTES_SOURCE))["Content-Security-Policy"] ?? "";
  expect(directiveNames(enforced).sort()).toEqual(["base-uri", "form-action", "frame-ancestors", "object-src"]);
});

test("the report-only CSP lists the ad hosts and takes extra script hashes and an optional report URI", () => {
  const reportOnly = (rules: HeaderRule[]): string => headerMap(rules[0])["Content-Security-Policy-Report-Only"] ?? "";
  const defaults = reportOnly(buildSecurityHeaders());
  expect(defaults).toContain("https://pagead2.googlesyndication.com");
  expect(defaults).toContain("frame-src https://*.googlesyndication.com");
  expect(defaults).not.toContain("report-uri");
  const withOptions = reportOnly(buildSecurityHeaders({ extraScriptHashes: ["'sha256-abc='"], reportUri: "/api/csp-report" }));
  const scriptSrc = withOptions.split(";").map((part) => part.trim()).find((part) => part.startsWith("script-src")) ?? "";
  expect(scriptSrc.split(" ")).toContain("'sha256-abc='");
  expect(withOptions).toContain("report-uri /api/csp-report");
  expect(reportOnly(buildSecurityHeaders({ reportUri: null }))).not.toContain("report-uri");
});

test("number-route matching follows the path rules", () => {
  for (const [pathname, expected] of NUMBER_ROUTE_ROWS) {
    expect(matches(NUMBER_ROUTE_SOURCE, pathname), pathname).toBe(expected);
  }
  expect(headerMap(ruleFor(NUMBER_ROUTE_SOURCE))).toEqual({ "X-Robots-Tag": "noindex, nofollow" });
});

test("internal routes are noindex, no-store and no-referrer, and come after the site-wide rule", () => {
  for (const pathname of ["/internal", "/internal/cs-helper", "/internal/ui-kit"]) {
    expect(matches(INTERNAL_ROUTES_SOURCE, pathname), pathname).toBe(true);
  }
  expect(matches(INTERNAL_ROUTES_SOURCE, "/internals")).toBe(false);
  expect(headerMap(ruleFor(INTERNAL_ROUTES_SOURCE))).toEqual({
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer"
  });
});

test("next.config.ts serves these rules and drops the X-Powered-By header", async () => {
  expect(existsSync(path.resolve(__dirname, "..", "..", "next.config.js"))).toBe(false);
  expect(nextConfig.poweredByHeader).toBe(false);
  expect(nextConfig.output).toBe("standalone");
  expect(nextConfig.allowedDevOrigins).toEqual(["127.0.0.1"]);
  // S08: next.config.ts passes the pre-paint script's hash into the Report-Only script-src.
  // S11: and the CSP report address (next.config.ts CSP_REPORT_URI, equal to CSP_REPORT_PATH).
  expect(await nextConfig.headers?.()).toEqual(
    buildSecurityHeaders({ extraScriptHashes: [PREPAINT_CSP_SOURCE], reportUri: CSP_REPORT_PATH }).map((rule) => ({ source: rule.source, headers: [...rule.headers] }))
  );
});
