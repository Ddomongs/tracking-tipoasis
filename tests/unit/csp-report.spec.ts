import { expect, test } from "@playwright/test";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import {
  CSP_LOG_LIMITS,
  CSP_REPORT_MAX_BYTES,
  CSP_REPORT_PATH,
  createCspReportLimiter,
  formatCspReportLog,
  handleCspReport,
  parseCspReports,
  setCspReportSink
} from "@/lib/security/csp-report";
import type { CspReportSummary } from "@/lib/security/csp-report";
import { FAKE } from "../fixtures/tracking-fixtures";

const PAGE = "https://tracking.tipoasis.com";
const AD_SCRIPT = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-x&url=${encodeURIComponent(`${PAGE}/${FAKE.domestic}`)}`;

function legacyReport(fields: Readonly<Record<string, string | number>>): unknown {
  return { "csp-report": fields };
}

function reportRequest(body: string, headers: Readonly<Record<string, string>> = {}): Request {
  return new Request(`${PAGE}${CSP_REPORT_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/csp-report", ...headers },
    body
  });
}

test.describe("CSP report summaries (S11)", () => {
  test("a legacy report becomes a fixed-shape summary without the addresses", () => {
    const [summary] = parseCspReports(
      legacyReport({
        "document-uri": `${PAGE}/${FAKE.domestic}?c=CJ`,
        referrer: `https://shop.example/orders/${FAKE.domestic}`,
        "violated-directive": "script-src-elem",
        "effective-directive": "script-src-elem",
        "original-policy": "default-src 'self'",
        "blocked-uri": AD_SCRIPT,
        "source-file": `${PAGE}/${FAKE.domestic}`,
        "line-number": 1,
        "script-sample": `track(${FAKE.domestic})`,
        disposition: "report",
        "status-code": 200
      })
    );
    expect(summary).toEqual({
      directive: "script-src-elem",
      blocked: "host",
      blockedHost: "pagead2.googlesyndication.com",
      documentKind: "number",
      disposition: "report"
    });
  });

  test("a Reporting API batch keeps only csp-violation entries, at most ten", () => {
    const entry = {
      type: "csp-violation",
      url: `${PAGE}/`,
      body: { documentURL: `${PAGE}/`, effectiveDirective: "style-src-attr", blockedURL: "inline", disposition: "enforce", sample: FAKE.hbl }
    };
    const batch = [...Array.from({ length: 12 }, () => entry), { type: "deprecation", body: {} }];
    const summaries = parseCspReports(batch);
    expect(summaries).toHaveLength(10);
    expect(summaries[0]).toEqual({ directive: "style-src-attr", blocked: "inline", blockedHost: null, documentKind: "home", disposition: "enforce" });
  });

  test("blocked addresses and pages fall into small enums", () => {
    const summarize = (blockedUri: string, documentUri = `${PAGE}/`): CspReportSummary | undefined =>
      parseCspReports(legacyReport({ "document-uri": documentUri, "effective-directive": "img-src", "blocked-uri": blockedUri }))[0];
    expect(summarize("eval")?.blocked).toBe("eval");
    expect(summarize("wasm-eval")?.blocked).toBe("eval");
    expect(summarize("data")?.blocked).toBe("data");
    expect(summarize("data:image/png;base64,AAAA")?.blocked).toBe("data");
    expect(summarize("blob")?.blocked).toBe("blob");
    expect(summarize(`${PAGE}/_next/static/chunk.js`)).toMatchObject({ blocked: "self", blockedHost: null });
    expect(summarize(`https://${FAKE.domestic}.example/x.js`)).toMatchObject({ blocked: "host", blockedHost: "[redacted]" });
    expect(summarize("chrome-extension://abc/x.js")?.blocked).toBe("other");
    expect(summarize("")?.blocked).toBe("other");
    expect(summarize("inline", `${PAGE}/privacy`)?.documentKind).toBe("privacy");
    expect(summarize("inline", `${PAGE}/internal/cs-helper`)?.documentKind).toBe("internal");
    expect(summarize("inline", `${PAGE}/${FAKE.hbl}`)?.documentKind).toBe("number");
    expect(summarize("inline", `${PAGE}/a/b`)?.documentKind).toBe("other");
    expect(summarize("inline", "about:blank")?.documentKind).toBe("other");
    expect(parseCspReports(legacyReport({ "violated-directive": "require-trusted-types-for 'script'" }))[0]?.directive).toBe("other");
  });

  test("malformed bodies produce no summary", () => {
    for (const body of [null, "report", 12, {}, { "csp-report": "x" }, [{ type: "csp-violation" }], [{ type: 1, body: {} }]]) {
      expect(parseCspReports(body), JSON.stringify(body)).toEqual([]);
    }
  });

  test("a log line has five fixed keys and never a number", () => {
    const line = formatCspReportLog({
      directive: "script-src-elem",
      blocked: "host",
      blockedHost: "pagead2.googlesyndication.com",
      documentKind: "number",
      disposition: "report"
    });
    expect(line).toBe(
      'csp_report {"directive":"script-src-elem","blocked":"host","blockedHost":"pagead2.googlesyndication.com","documentKind":"number","disposition":"report"}'
    );
    expect(containsTrackingLikeValue(line)).toBe(false);
  });

  test("the limiter admits each distinct line once per ten minutes and at most sixty lines a minute", () => {
    const limiter = createCspReportLimiter();
    expect(limiter.admit("a", 0)).toBe(true);
    expect(limiter.admit("a", 1000)).toBe(false);
    expect(limiter.admit("a", CSP_LOG_LIMITS.dedupeMs)).toBe(true);
    const flood = createCspReportLimiter();
    const admitted = Array.from({ length: 100 }, (_, index) => flood.admit(`line-${index}`, 5)).filter(Boolean).length;
    expect(admitted).toBe(CSP_LOG_LIMITS.maxPerWindow);
    expect(flood.admit("next-minute", 5 + CSP_LOG_LIMITS.windowMs)).toBe(true);
  });
});

test.describe("CSP report endpoint (S11)", () => {
  const lines: string[] = [];
  test.beforeEach(() => {
    lines.length = 0;
    setCspReportSink((line) => lines.push(line));
  });
  test.afterEach(() => setCspReportSink(null));

  test("a report with a number in every address is logged as a number-free summary and answered with 204", async () => {
    const body = JSON.stringify(
      legacyReport({
        "document-uri": `${PAGE}/${FAKE.domestic}`,
        referrer: `https://shop.example/${FAKE.hbl}`,
        "effective-directive": "script-src-elem",
        "blocked-uri": AD_SCRIPT
      })
    );
    const response = await handleCspReport(reportRequest(body), { limiter: createCspReportLimiter(), now: () => 0 });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(lines).toHaveLength(1);
    expect(containsTrackingLikeValue(lines.join("\n"))).toBe(false);
  });

  test("oversized, foreign and malformed requests are ignored without a log line", async () => {
    const limiter = createCspReportLimiter();
    const valid = JSON.stringify(legacyReport({ "document-uri": `${PAGE}/`, "blocked-uri": "inline", "effective-directive": "script-src-elem" }));
    const requests = [
      reportRequest(valid, { "content-length": String(CSP_REPORT_MAX_BYTES + 1) }),
      reportRequest(`${valid}${" ".repeat(CSP_REPORT_MAX_BYTES)}`),
      reportRequest(valid, { "content-type": "text/plain" }),
      reportRequest("{not json")
    ];
    for (const request of requests) {
      const response = await handleCspReport(request, { limiter, now: () => 0 });
      expect(response.status).toBe(204);
    }
    expect(lines).toEqual([]);
  });
});
