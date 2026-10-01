import { handleCspReport } from "@/lib/security/csp-report";

/** Receives CSP Report-Only violations (report-uri in next.config.ts). Logic and privacy rules: lib/security/csp-report.ts. */
export async function POST(request: Request): Promise<Response> {
  return handleCspReport(request);
}
