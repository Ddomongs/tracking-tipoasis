import type { FailureCause, FailureInput, GuideKey } from "@/lib/tracking/types";

const INVALID_STATUSES: ReadonlySet<number> = new Set([400, 413, 415]);
const UPSTREAM_TIMEOUT_STATUSES: ReadonlySet<number> = new Set([408, 503, 504]);
const RATE_LIMITED_STATUS = 429;
const NOT_FOUND_STATUS = 404;

const GUIDE_KEY_BY_CAUSE: Readonly<Record<FailureCause, GuideKey>> = {
  invalidNumber: "invalidNumber",
  notFound: "notFound",
  rateLimited: "temporaryDelay",
  upstreamTimeout: "temporaryDelay",
  badGateway: "temporaryDelay",
  network: "temporaryDelay",
  offline: "offline",
  clientTimeout: "noResponse",
  serverError: "serverError",
  contractViolation: "serverError"
};

function classifyHttp(status: number, code: string | null, isJson: boolean): FailureCause {
  if (status === RATE_LIMITED_STATUS) return "rateLimited";
  if (INVALID_STATUSES.has(status)) return "invalidNumber";
  if (!isJson) return "badGateway";
  if (status === NOT_FOUND_STATUS && code === "NOT_FOUND") return "notFound";
  if (UPSTREAM_TIMEOUT_STATUSES.has(status)) return "upstreamTimeout";
  return "serverError";
}

/** Maps what the client observed to one failure cause. Server message text is never used. */
export function classifyFailure(input: FailureInput): FailureCause {
  switch (input.kind) {
    case "precheck":
      return "invalidNumber";
    case "contract":
      return "contractViolation";
    case "network":
      return input.online ? "network" : "offline";
    case "timeout":
      return "clientTimeout";
    case "http":
      return classifyHttp(input.status, input.code, input.isJson);
  }
}

export function guideKeyForFailure(cause: FailureCause): GuideKey {
  return GUIDE_KEY_BY_CAUSE[cause];
}
