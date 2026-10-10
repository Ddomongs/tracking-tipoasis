import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./lib/security/headers";
import { PREPAINT_CSP_SOURCE } from "./lib/style/prepaint";

/**
 * CSP Report-Only violations go here (app/api/csp-report/route.ts). Equal to CSP_REPORT_PATH in lib/security/csp-report.ts,
 * pinned by tests/unit/csp-report.spec.ts; a literal because this file cannot import modules that use the "@/" alias.
 */
const CSP_REPORT_URI = "/api/csp-report";

/**
 * Legacy links '/?trackingNumber=X' → 307 '/X' (spec §3). Only a value that starts with a letter or digit and
 * continues with letters, digits, spaces or hyphens (64 characters at most) is redirected: '//host' cannot
 * become an open redirect and non-ASCII values cannot produce an invalid Location header (500). The route names
 * 'internal', 'api', 'privacy' and 'guide' stay on '/' (no basic-auth prompt or 404 from an old link). Whitespace around
 * the value (a pasted number sent by the form before hydration) is left outside the captured number.
 * Next passes the query through ('/X?trackingNumber=X&c=…'); the candidate-B scrub removes it in the browser.
 */
const LEGACY_TRACKING_QUERY_VALUE =
  "\\s*(?<trackingNumber>(?!(?:internal|api|privacy|guide)\\s*$)[A-Za-z0-9][A-Za-z0-9 -]{0,63}?)\\s*";

/**
 * tipoasis.com (the apex, 10월 10일 요청) is the company page: '/' shows app/(company)/company, and every other path
 * (old WordPress blog links) goes to '/' — except Next assets and the page itself. www serves the same page (canonical: apex).
 * Next anchors the value (^…$), so tracking.tipoasis.com never matches.
 */
const COMPANY_HOST = [{ type: "host" as const, value: "(?:www\\.)?tipoasis\\.com" }];

const nextConfig: NextConfig = {
  output: "standalone",
  // Playwright drives `next dev` through 127.0.0.1; Next 16 blocks non-localhost dev origins by default.
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  // Stage-1 security headers, number-route noindex and /internal isolation (lib/security/headers.ts).
  headers: async () =>
    buildSecurityHeaders({ extraScriptHashes: [PREPAINT_CSP_SOURCE], reportUri: CSP_REPORT_URI }).map((rule) => ({
      source: rule.source,
      headers: [...rule.headers]
    })),
  redirects: async () => [
    {
      source: "/",
      has: [{ type: "query", key: "trackingNumber", value: LEGACY_TRACKING_QUERY_VALUE }],
      destination: "/:trackingNumber",
      permanent: false
    },
    {
      source: "/:path((?!_next/|company$|icon\\.svg$).+)",
      has: COMPANY_HOST,
      destination: "/",
      permanent: true
    }
  ],
  rewrites: async () => ({
    beforeFiles: [{ source: "/", has: COMPANY_HOST, destination: "/company" }],
    afterFiles: [],
    fallback: []
  })
};

export default nextConfig;
