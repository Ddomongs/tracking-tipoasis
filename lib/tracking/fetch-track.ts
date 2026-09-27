import type { FailureInput, LookupRequest } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

// Browser module (contract §11.2): the only client code that calls /api/track. The response schema (zod) loads with a dynamic import on
// the first 2xx body, so the initial bundle never contains it (contract §11.1 rule 3). Server `message` text is never read (spec §5).

export type FetchTrackResult =
  | { readonly kind: "success"; readonly data: TrackResponseData }
  | { readonly kind: "failure"; readonly input: FailureInput }
  | { readonly kind: "aborted" }; // caller aborted (cancel or superseded)

const TRACK_ENDPOINT = "/api/track";

type StopReason = "caller" | "timeout";
type ParsedBody = { readonly ok: true; readonly value: unknown } | { readonly ok: false };

function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function parseJson(text: string): ParsedBody {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false }; // HTML error pages and empty bodies are "not JSON", never a crash
  }
}

/** `error.code` of a JSON error body (`{ success: false, error: { code } }`); null for any other shape. */
function errorCodeOf(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("error" in value)) return null;
  const error: unknown = value.error;
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

async function readBody(status: number, ok: boolean, text: string): Promise<FetchTrackResult> {
  const body = parseJson(text);
  if (!body.ok) return { kind: "failure", input: { kind: "http", status, code: null, isJson: false } };
  if (!ok) return { kind: "failure", input: { kind: "http", status, code: errorCodeOf(body.value), isJson: true } };
  const { ApiTrackResponseSchema } = await import("@/lib/schemas");
  const parsed = ApiTrackResponseSchema.safeParse(body.value);
  if (parsed.success && parsed.data.success) return { kind: "success", data: parsed.data.data };
  return { kind: "failure", input: { kind: "contract" } };
}

export async function fetchTrack(
  request: LookupRequest,
  options: { readonly signal: AbortSignal; readonly timeoutMs: number }
): Promise<FetchTrackResult> {
  if (options.signal.aborted) return { kind: "aborted" };
  const controller = new AbortController();
  let stopped: StopReason | null = null;
  const stop = (reason: StopReason): void => {
    if (stopped !== null) return;
    stopped = reason;
    controller.abort();
  };
  const onCallerAbort = (): void => stop("caller");
  options.signal.addEventListener("abort", onCallerAbort, { once: true });
  const timer = setTimeout(() => stop("timeout"), options.timeoutMs);
  const interrupted = (): FetchTrackResult | null => {
    if (stopped === "caller") return { kind: "aborted" };
    if (stopped === "timeout") return { kind: "failure", input: { kind: "timeout" } };
    return null;
  };

  try {
    const response = await fetch(TRACK_ENDPOINT, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trackingNumber: request.number, carrierCode: request.carrier }),
      signal: controller.signal
    });
    const text = await response.text();
    const result = interrupted() ?? (await readBody(response.status, response.ok, text));
    return interrupted() ?? result;
  } catch {
    // A TypeError on network loss, an AbortError when stopped, or a failed chunk load of the schema all land here.
    return interrupted() ?? { kind: "failure", input: { kind: "network", online: isOnline() } };
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener("abort", onCallerAbort);
  }
}
