import { z } from "zod";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";

/**
 * CSP Report-Only collection (spec §12 "최소 강제 CSP + Report-Only", §16 item 16: observe before deciding strict CSP).
 * Server only. A browser report carries the page address (document-uri), the blocked address and sometimes the referrer,
 * so nothing from it is stored or logged as-is: each report becomes a fixed-shape, number-free summary line, and the
 * lines are rate-limited and de-duplicated per server instance.
 */
export const CSP_REPORT_PATH = "/api/csp-report";
export const CSP_REPORT_MAX_BYTES = 16384;
export const CSP_REPORT_MAX_PER_BODY = 10;
export const CSP_LOG_EVENT = "csp_report";

const KNOWN_DIRECTIVES = [
  "default-src", "script-src", "script-src-elem", "script-src-attr", "style-src", "style-src-elem", "style-src-attr",
  "img-src", "font-src", "connect-src", "frame-src", "child-src", "worker-src", "manifest-src", "media-src",
  "object-src", "base-uri", "form-action", "frame-ancestors"
] as const;
export type CspDirective = (typeof KNOWN_DIRECTIVES)[number] | "other";
export type BlockedKind = "inline" | "eval" | "data" | "blob" | "self" | "host" | "other";
export type DocumentKind = "home" | "number" | "privacy" | "guide" | "internal" | "other";

export interface CspReportSummary {
  readonly directive: CspDirective;
  readonly blocked: BlockedKind;
  readonly blockedHost: string | null; // hostname only, for "host"; "[redacted]" when it looks like it carries a number
  readonly documentKind: DocumentKind;
  readonly disposition: "enforce" | "report";
}

const LegacyReportSchema = z.object({
  "csp-report": z
    .object({
      "document-uri": z.string().max(4096).optional(),
      "violated-directive": z.string().max(1024).optional(),
      "effective-directive": z.string().max(256).optional(),
      "blocked-uri": z.string().max(4096).optional(),
      disposition: z.string().max(32).optional()
    })
    .passthrough()
});
const ReportingApiSchema = z
  .array(
    z
      .object({
        type: z.string(),
        body: z
          .object({
            documentURL: z.string().max(4096).optional(),
            effectiveDirective: z.string().max(256).optional(),
            blockedURL: z.string().max(4096).optional(),
            disposition: z.string().max(32).optional()
          })
          .passthrough()
      })
      .passthrough()
  )
  .max(100);

interface RawReport {
  readonly documentUri: string;
  readonly directive: string;
  readonly blockedUri: string;
  readonly disposition: string;
}

const SAFE_HOST = /^[a-z0-9.-]{1,253}$/;
const REDACTED_HOST = "[redacted]";

const isKnownDirective = (value: string): value is (typeof KNOWN_DIRECTIVES)[number] =>
  (KNOWN_DIRECTIVES as readonly string[]).includes(value);

function toDirective(value: string): CspDirective {
  const name = value.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return isKnownDirective(name) ? name : "other";
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function toDocumentKind(documentUri: string): DocumentKind {
  const url = parseUrl(documentUri);
  if (url === null) return "other";
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  if (path === "/privacy") return "privacy";
  if (path === "/guide" || path.startsWith("/guide/")) return "guide";
  if (path === "/internal" || path.startsWith("/internal/")) return "internal";
  return /^\/[^/.]+$/.test(path) ? "number" : "other";
}

function toBlocked(blockedUri: string, documentUri: string): Pick<CspReportSummary, "blocked" | "blockedHost"> {
  const value = blockedUri.trim().toLowerCase();
  if (value === "inline") return { blocked: "inline", blockedHost: null };
  if (value === "eval" || value === "wasm-eval") return { blocked: "eval", blockedHost: null };
  if (value === "data" || value.startsWith("data:")) return { blocked: "data", blockedHost: null };
  if (value === "blob" || value.startsWith("blob:")) return { blocked: "blob", blockedHost: null };
  const blocked = parseUrl(blockedUri);
  if (blocked === null || (blocked.protocol !== "https:" && blocked.protocol !== "http:")) return { blocked: "other", blockedHost: null };
  const page = parseUrl(documentUri);
  if (page !== null && page.origin === blocked.origin) return { blocked: "self", blockedHost: null };
  const host = blocked.hostname;
  // Dots are not separators for the number patterns, so a host like 'dddddd.dddddd.example' is checked without them too.
  const safe = SAFE_HOST.test(host) && !containsTrackingLikeValue(host) && !containsTrackingLikeValue(host.replace(/\./g, ""));
  return { blocked: "host", blockedHost: safe ? host : REDACTED_HOST };
}

function toDisposition(value: string): CspReportSummary["disposition"] {
  return value.toLowerCase() === "enforce" ? "enforce" : "report";
}

function summarize(raw: RawReport): CspReportSummary {
  return {
    directive: toDirective(raw.directive),
    ...toBlocked(raw.blockedUri, raw.documentUri),
    documentKind: toDocumentKind(raw.documentUri),
    disposition: toDisposition(raw.disposition)
  };
}

/**
 * Both report formats: `application/csp-report` (report-uri) and `application/reports+json` (Reporting API). With
 * `report-uri` alone browsers send only the first; if `report-to` is added later, the number-route override in
 * lib/security/headers.ts must drop it (and `Reporting-Endpoints`) there too.
 */
export function parseCspReports(body: unknown): readonly CspReportSummary[] {
  const legacy = LegacyReportSchema.safeParse(body);
  if (legacy.success) {
    const report = legacy.data["csp-report"];
    return [
      summarize({
        documentUri: report["document-uri"] ?? "",
        directive: report["effective-directive"] ?? report["violated-directive"] ?? "",
        blockedUri: report["blocked-uri"] ?? "",
        disposition: report.disposition ?? ""
      })
    ];
  }
  const modern = ReportingApiSchema.safeParse(body);
  if (!modern.success) return [];
  return modern.data
    .filter((report) => report.type === "csp-violation")
    .slice(0, CSP_REPORT_MAX_PER_BODY)
    .map((report) =>
      summarize({
        documentUri: report.body.documentURL ?? "",
        directive: report.body.effectiveDirective ?? "",
        blockedUri: report.body.blockedURL ?? "",
        disposition: report.body.disposition ?? ""
      })
    );
}

/** `csp_report {"directive":…,"blocked":…,"blockedHost":…,"documentKind":…,"disposition":…}` — five fixed keys, no number. */
export function formatCspReportLog(summary: CspReportSummary): string {
  const line = `${CSP_LOG_EVENT} ${JSON.stringify({
    directive: summary.directive,
    blocked: summary.blocked,
    blockedHost: summary.blockedHost,
    documentKind: summary.documentKind,
    disposition: summary.disposition
  })}`;
  return containsTrackingLikeValue(line) ? `${CSP_LOG_EVENT} {"redacted":true}` : line;
}

export interface CspReportLimiter {
  /** true when this summary may be logged now: at most `maxPerWindow` lines per window, each distinct line once per `dedupeMs`. */
  readonly admit: (line: string, now: number) => boolean;
}

export const CSP_LOG_LIMITS = { windowMs: 60000, maxPerWindow: 60, dedupeMs: 600000, remembered: 200 } as const;

export function createCspReportLimiter(limits: typeof CSP_LOG_LIMITS = CSP_LOG_LIMITS): CspReportLimiter {
  let windowStart = Number.NEGATIVE_INFINITY;
  let count = 0;
  let seen: ReadonlyMap<string, number> = new Map();
  return {
    admit: (line: string, now: number): boolean => {
      if (now - windowStart >= limits.windowMs) {
        windowStart = now;
        count = 0;
      }
      const lastAt = seen.get(line);
      if (lastAt !== undefined && now - lastAt < limits.dedupeMs) return false;
      if (count >= limits.maxPerWindow) return false;
      count += 1;
      const recent = [...seen].filter(([, at]) => now - at < limits.dedupeMs).slice(-(limits.remembered - 1));
      seen = new Map([...recent, [line, now]]);
      return true;
    }
  };
}

export type CspLogSink = (line: string) => void;
const consoleSink: CspLogSink = (line) => console.info(line);
let sink: CspLogSink = consoleSink;

/** Test seam; null restores the console sink. */
export function setCspReportSink(next: CspLogSink | null): void {
  sink = next ?? consoleSink;
}

const ACCEPTED_TYPES = ["application/csp-report", "application/reports+json", "application/json"] as const;
const sharedLimiter = createCspReportLimiter();

/** The body as text, or null when it is unreadable or longer than `maxBytes` (stops reading there; no content-length needed). */
async function readBodyWithin(request: Request, maxBytes: number): Promise<string | null> {
  if (request.body === null) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function noContent(): Response {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/csp-report. Always answers 204 (a reporter learns nothing). Oversized, foreign or malformed bodies are ignored
 * without logging; valid reports become summary lines through the limiter.
 */
export async function handleCspReport(
  request: Request,
  options: { readonly limiter?: CspReportLimiter; readonly now?: () => number } = {}
): Promise<Response> {
  const limiter = options.limiter ?? sharedLimiter;
  const now = options.now ?? Date.now;
  const type = (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (!(ACCEPTED_TYPES as readonly string[]).includes(type)) return noContent();
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > CSP_REPORT_MAX_BYTES) return noContent();
  const text = await readBodyWithin(request, CSP_REPORT_MAX_BYTES);
  if (text === null) return noContent();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return noContent();
  }
  for (const summary of parseCspReports(body)) {
    const line = formatCspReportLog(summary);
    if (limiter.admit(line, now())) sink(line);
  }
  return noContent();
}
