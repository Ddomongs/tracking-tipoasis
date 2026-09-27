import { expect, test } from "@playwright/test";
// Loads the schema module into the Node test runner's CommonJS cache so fetchTrack's dynamic import("@/lib/schemas") resolves here;
// Next.js code-splits the same import in the browser bundle.
import { ApiTrackResponseSchema } from "@/lib/schemas";
import { classifyFailure } from "@/lib/tracking/classify-failure";
import { fetchTrack } from "@/lib/tracking/fetch-track";
import type { FetchTrackResult } from "@/lib/tracking/fetch-track";
import type { FailureCause, LookupRequest } from "@/lib/tracking/types";
import { FAILURE_RESPONSES, FAKE, successBody, trackData } from "../fixtures/tracking-fixtures";
import type { FailureFixture } from "../fixtures/tracking-fixtures";

const REQUEST: LookupRequest = { number: FAKE.domestic, carrier: "HANJIN", entry: "manual" };
const LONG_TIMEOUT_MS = 5_000;
const SHORT_TIMEOUT_MS = 30;

interface SeenCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}
type FetchStub = (input: unknown, init?: RequestInit) => Promise<Response>;

let calls: SeenCall[] = [];
const realFetch: unknown = Reflect.get(globalThis, "fetch");
const realNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function setFetch(stub: FetchStub): void {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: (input: unknown, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(input), init });
      return stub(input, init);
    }
  });
}

function answer(reply: { readonly status: number; readonly contentType: string; readonly body: string }): void {
  setFetch(async () => new Response(reply.body, { status: reply.status, headers: { "content-type": reply.contentType } }));
}

/** A server that never answers: the request ends only when its signal aborts, like a real fetch. */
function hang(): void {
  setFetch(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")));
      })
  );
}

function setOnline(online: boolean): void {
  Object.defineProperty(globalThis, "navigator", { configurable: true, get: () => ({ onLine: online }) });
}

function run(timeoutMs = LONG_TIMEOUT_MS, signal: AbortSignal = new AbortController().signal): Promise<FetchTrackResult> {
  return fetchTrack(REQUEST, { signal, timeoutMs });
}

function inputOf(result: FetchTrackResult): Extract<FetchTrackResult, { kind: "failure" }>["input"] {
  if (result.kind !== "failure") throw new Error(`expected a failure, got ${result.kind}`);
  return result.input;
}

test.beforeEach(() => {
  calls = [];
});

test.afterEach(() => {
  Object.defineProperty(globalThis, "fetch", { configurable: true, writable: true, value: realFetch });
  if (realNavigator) Object.defineProperty(globalThis, "navigator", realNavigator);
  else Reflect.deleteProperty(globalThis, "navigator");
});

test("posts the number and the carrier to /api/track and returns the parsed data", async () => {
  const data = trackData("inTransit");
  answer({ status: 200, contentType: "application/json", body: successBody(data) });
  expect(await run()).toEqual({ kind: "success", data });
  expect(ApiTrackResponseSchema.safeParse(JSON.parse(successBody(data))).success).toBe(true);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.url).toBe("/api/track");
  expect(calls[0]?.init?.method).toBe("POST");
  expect(calls[0]?.init?.cache).toBe("no-store");
  expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ trackingNumber: FAKE.domestic, carrierCode: "HANJIN" });
});

const EXPECTED: Readonly<Record<FailureFixture, { readonly result: FetchTrackResult; readonly cause: FailureCause }>> = {
  invalid400: { result: { kind: "failure", input: { kind: "http", status: 400, code: "INVALID_NUMBER", isJson: true } }, cause: "invalidNumber" },
  notFound404: { result: { kind: "failure", input: { kind: "http", status: 404, code: "NOT_FOUND", isJson: true } }, cause: "notFound" },
  rateLimited429: { result: { kind: "failure", input: { kind: "http", status: 429, code: "RATE_LIMITED", isJson: true } }, cause: "rateLimited" },
  upstreamTimeout504: { result: { kind: "failure", input: { kind: "http", status: 504, code: "API_TIMEOUT", isJson: true } }, cause: "upstreamTimeout" },
  unavailable503: { result: { kind: "failure", input: { kind: "http", status: 503, code: "API_TIMEOUT", isJson: true } }, cause: "upstreamTimeout" },
  serverError500: { result: { kind: "failure", input: { kind: "http", status: 500, code: "SERVER_ERROR", isJson: true } }, cause: "serverError" },
  badGatewayHtml502: { result: { kind: "failure", input: { kind: "http", status: 502, code: null, isJson: false } }, cause: "badGateway" },
  contractViolation200: { result: { kind: "failure", input: { kind: "contract" } }, cause: "contractViolation" }
};

for (const name of Object.keys(EXPECTED) as FailureFixture[]) {
  test(`${name}: mapped to what the client observed, never to the server message`, async () => {
    answer(FAILURE_RESPONSES[name]);
    const result = await run();
    expect(result).toEqual(EXPECTED[name].result);
    expect(classifyFailure(inputOf(result))).toBe(EXPECTED[name].cause);
    expect(JSON.stringify(result)).not.toContain("message");
  });
}

test("a JSON error body is read as JSON even with a wrong content type", async () => {
  answer({ ...FAILURE_RESPONSES.notFound404, contentType: "text/plain" });
  expect(await run()).toEqual({ kind: "failure", input: { kind: "http", status: 404, code: "NOT_FOUND", isJson: true } });
});

test("a 200 HTML page is not JSON and reads as a temporary gateway problem", async () => {
  answer({ status: 200, contentType: "text/html", body: "<html><body>maintenance</body></html>" });
  const input = inputOf(await run());
  expect(input).toEqual({ kind: "http", status: 200, code: null, isJson: false });
  expect(classifyFailure(input)).toBe("badGateway");
});

test("an empty body is not JSON", async () => {
  answer({ status: 503, contentType: "application/json", body: "" });
  expect(inputOf(await run())).toEqual({ kind: "http", status: 503, code: null, isJson: false });
});

test("a failed request reads as network while online and as offline while offline", async () => {
  setFetch(async () => {
    throw new TypeError("Failed to fetch");
  });
  setOnline(true);
  const online = inputOf(await run());
  expect(online).toEqual({ kind: "network", online: true });
  expect(classifyFailure(online)).toBe("network");
  setOnline(false);
  const offline = inputOf(await run());
  expect(offline).toEqual({ kind: "network", online: false });
  expect(classifyFailure(offline)).toBe("offline");
});

test("our timeout stops the request and reports a timeout", async () => {
  hang();
  const started = Date.now();
  const input = inputOf(await run(SHORT_TIMEOUT_MS));
  expect(input).toEqual({ kind: "timeout" });
  expect(classifyFailure(input)).toBe("clientTimeout");
  expect(Date.now() - started).toBeLessThan(LONG_TIMEOUT_MS);
  expect(calls[0]?.init?.signal?.aborted).toBe(true);
});

test("the caller's abort ends the request as aborted, not as a failure", async () => {
  hang();
  const controller = new AbortController();
  const pending = run(LONG_TIMEOUT_MS, controller.signal);
  setTimeout(() => controller.abort(), 10);
  expect(await pending).toEqual({ kind: "aborted" });
});

test("an already aborted signal never calls the server", async () => {
  answer({ status: 200, contentType: "application/json", body: successBody(trackData("pending")) });
  const controller = new AbortController();
  controller.abort();
  expect(await run(LONG_TIMEOUT_MS, controller.signal)).toEqual({ kind: "aborted" });
  expect(calls).toEqual([]);
});
