import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./lib/security/headers";

/**
 * Legacy links '/?trackingNumber=X' → 307 '/X' (spec §3). Only a value that starts with a letter or digit and
 * continues with letters, digits, spaces or hyphens (64 characters at most) is redirected: '//host' cannot
 * become an open redirect and non-ASCII values cannot produce an invalid Location header (500). The route names
 * 'internal', 'api' and 'privacy' stay on '/' (no basic-auth prompt or 404 from an old link).
 * Next passes the query through ('/X?trackingNumber=X&c=…'); the candidate-B scrub removes it in the browser.
 */
const LEGACY_TRACKING_QUERY_VALUE = "(?<trackingNumber>(?!(?:internal|api|privacy)$)[A-Za-z0-9][A-Za-z0-9 -]{0,63})";

const nextConfig: NextConfig = {
  output: "standalone",
  // Playwright drives `next dev` through 127.0.0.1; Next 16 blocks non-localhost dev origins by default.
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  // Stage-1 security headers, number-route noindex and /internal isolation (lib/security/headers.ts).
  headers: async () => buildSecurityHeaders().map((rule) => ({ source: rule.source, headers: [...rule.headers] })),
  redirects: async () => [
    {
      source: "/",
      has: [{ type: "query", key: "trackingNumber", value: LEGACY_TRACKING_QUERY_VALUE }],
      destination: "/:trackingNumber",
      permanent: false
    }
  ]
};

export default nextConfig;
