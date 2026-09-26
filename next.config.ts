import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  output: "standalone",
  // Playwright drives `next dev` through 127.0.0.1; Next 16 blocks non-localhost dev origins by default.
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  // Stage-1 security headers, number-route noindex and /internal isolation (lib/security/headers.ts).
  headers: async () => buildSecurityHeaders().map((rule) => ({ source: rule.source, headers: [...rule.headers] }))
};

export default nextConfig;
