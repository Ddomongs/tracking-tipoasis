/**
 * Security and indexing headers (spec §12 "보안·SEO" stage 1, §3 number routes, §10 /internal).
 * next.config.ts imports this file by relative path, so it must not import anything through the "@/" alias.
 */
export interface HeaderRule {
  readonly source: string;
  readonly headers: ReadonlyArray<{ readonly key: string; readonly value: string }>;
}

export interface SecurityHeaderOptions {
  /** Source expressions such as `'sha256-…'` added to the report-only script-src (S08: the pre-paint script). */
  readonly extraScriptHashes?: readonly string[];
  /** Report-only violation endpoint (S11: "/api/csp-report"). */
  readonly reportUri?: string | null;
}

/** Every route. Listed first: later rules override the same header key. */
export const ALL_ROUTES_SOURCE = "/:path*";
/** Single-segment number-like paths: no dot, not a known top-level route. */
export const NUMBER_ROUTE_SOURCE = "/:number((?!privacy$|internal$|api$|guide$|company$)[^/.]+)";
export const INTERNAL_ROUTES_SOURCE = "/internal/:path*";

const NOINDEX = "noindex, nofollow";
const HSTS = "max-age=63072000; includeSubDomains";
const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";

/**
 * Enforced now. It blocks plugins, <base> hijacking, framing by other sites and cross-site form posts, and never limits
 * scripts, styles, images, fonts or connections, so Next.js inline scripts and AdSense keep working (strict CSP = approval 16).
 */
const ENFORCED_CSP = ["base-uri 'self'", "object-src 'none'", "frame-ancestors 'self'", "form-action 'self'"].join("; ");

const AD_HOSTS = [
  "https://pagead2.googlesyndication.com",
  "https://*.googlesyndication.com",
  "https://*.adtrafficquality.google",
  "https://*.doubleclick.net",
  "https://*.google.com",
  "https://*.gstatic.com"
] as const;
const AD_FRAME_HOSTS = [
  "https://*.googlesyndication.com",
  "https://*.doubleclick.net",
  "https://*.google.com",
  "https://*.adtrafficquality.google"
] as const;

/** Observation only: what a stricter policy would block shows up in the browser console (and at reportUri once S11 adds it). */
function reportOnlyCsp(options: SecurityHeaderOptions): string {
  const directives = [
    "default-src 'self'",
    ["script-src 'self' 'unsafe-inline'", ...(options.extraScriptHashes ?? []), ...AD_HOSTS].join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    ["connect-src 'self'", ...AD_HOSTS].join(" "),
    ["frame-src", ...AD_FRAME_HOSTS].join(" "),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'"
  ];
  const reporting = options.reportUri ? [`report-uri ${options.reportUri}`] : [];
  return [...directives, ...reporting].join("; ");
}

/** Rules for next.config.ts headers(): every route, then number routes, then /internal (later rules win per key). */
export function buildSecurityHeaders(options: SecurityHeaderOptions = {}): HeaderRule[] {
  return [
    {
      source: ALL_ROUTES_SOURCE,
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin" },
        { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
        { key: "Strict-Transport-Security", value: HSTS },
        { key: "Content-Security-Policy", value: ENFORCED_CSP },
        { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp(options) }
      ]
    },
    {
      source: NUMBER_ROUTE_SOURCE,
      headers: [
        { key: "X-Robots-Tag", value: NOINDEX },
        // S11: number-route documents never post CSP reports — a report would carry the number in its document-uri.
        ...(options.reportUri
          ? [{ key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp({ ...options, reportUri: null }) }]
          : [])
      ]
    },
    {
      source: INTERNAL_ROUTES_SOURCE,
      headers: [
        { key: "X-Robots-Tag", value: NOINDEX },
        { key: "Cache-Control", value: "no-store" },
        { key: "Referrer-Policy", value: "no-referrer" }
      ]
    }
  ];
}
