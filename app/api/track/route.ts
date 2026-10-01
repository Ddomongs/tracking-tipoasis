import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { buildTrackCacheKey, getCache, setCache } from "@/lib/cache";
import { getDeliveryCarrier } from "@/lib/delivery-carriers";
import { TrackRequestSchema } from "@/lib/schemas";
import { acquireRequestSlot, consumeRequestQuota, releaseRequestSlot } from "@/lib/rate-limit";
import { lookupCustomsEvents, type CustomsLookupResult, type CustomsLookupType } from "@/lib/services/customs";
import { fetchCustomstrackCustomsEvents } from "@/lib/services/customstrack";
import { fetchDeliveryTracking } from "@/lib/services/delivery";
import { readRequestTextWithLimit } from "@/lib/services/http";
import { identifyTrackingNumber } from "@/lib/services/identifier";
import {
  LOOKUP_CACHE_SECONDS,
  LOOKUP_TIMING,
  createLookupDeadline,
  withinMs,
  type LookupDeadline
} from "@/lib/services/lookup-budget";
import {
  createUnipassTally,
  elapsedBucket,
  logLookup,
  type LookupResultKind,
  type UnipassTally
} from "@/lib/services/lookup-log";
import { normalizeTrackingData } from "@/lib/services/normalizer";
import type { ApiError, DeliveryCarrierCode, DeliveryLookupResult, TrackResponseData, TrackingEvent } from "@/lib/types";

/** Vercel ends the function here; the in-code budget (LOOKUP_TIMING.budgetMs, 15 s) answers well before. */
export const maxDuration = 30;

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0"
};

const TEMPORARY_FAILURE_MESSAGE = "조회 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요";

const INVALID_NUMBER_ERROR: ApiError = {
  code: "INVALID_NUMBER",
  message: "입력하신 번호의 형식을 확인할 수 없습니다. HBL/화물관리번호/국내 운송장 번호를 다시 확인해주세요."
};

interface RouteOutcome {
  readonly response: Response;
  readonly kind: LookupResultKind;
  readonly code: ApiError["code"] | null;
}

interface LookupTarget {
  readonly number: string;
  readonly type: CustomsLookupType;
  readonly carrierCode: DeliveryCarrierCode;
  readonly cacheKey: string;
}

interface CustomsOutcome {
  readonly unipass: CustomsLookupResult;
  readonly events: TrackingEvent[];
  /** UNI-PASS answered "no record" on every call and customstrack answered too: only then may "nothing" be cached. */
  readonly answeredEmpty: boolean;
}

const errorResponse = (error: ApiError, status: number): Response =>
  NextResponse.json({ success: false, error }, { status, headers: noStoreHeaders });

const successResponse = (data: TrackResponseData): Response =>
  NextResponse.json({ success: true, data }, { headers: noStoreHeaders });

const errorOutcome = (error: ApiError, status: number, kind: LookupResultKind): RouteOutcome => ({
  response: errorResponse(error, status),
  kind,
  code: error.code
});

const notFoundOutcome = (kind: "notFound" | "notFoundCached"): RouteOutcome =>
  errorOutcome({ code: "NOT_FOUND", message: "해당 번호로 통관/배송 정보를 찾을 수 없습니다" }, 404, kind);

/** Every upstream that decides the answer failed: tell the client "try again", never "not found". */
const allFailedOutcome = (timedOut: boolean): RouteOutcome =>
  errorOutcome({ code: "API_TIMEOUT", message: TEMPORARY_FAILURE_MESSAGE }, timedOut ? 504 : 503, "allFailed");

const isExternalFetchError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "AbortError" || error.message.includes("fetch failed") || error.message.includes("UND_ERR"));

const shouldCacheTrackResult = (params: {
  type: string;
  customsEvents: TrackingEvent[];
  deliveryEvents: TrackingEvent[];
  lookupUnavailable: boolean;
  ambiguous: boolean;
}): boolean => {
  if (params.lookupUnavailable || params.ambiguous) return false;

  if (params.type === "DOMESTIC" && params.customsEvents.length === 0 && params.deliveryEvents.length > 0) {
    return false;
  }

  return true;
};

const notFoundCacheKey = (cacheKey: string): string => `${cacheKey}:not-found`;

const readCachedOutcome = (cacheKey: string): RouteOutcome | null => {
  const cached = getCache<TrackResponseData>(cacheKey);
  if (cached) return { response: successResponse(cached), kind: "cached", code: null };
  return getCache<boolean>(notFoundCacheKey(cacheKey)) === true ? notFoundOutcome("notFoundCached") : null;
};

const autoDelivery = (): DeliveryLookupResult => ({
  carrier: getDeliveryCarrier("AUTO").name,
  carrierCode: "AUTO",
  events: []
});

const unavailableDelivery = (target: LookupTarget): DeliveryLookupResult => {
  const carrier = getDeliveryCarrier(target.carrierCode);
  return {
    carrier: carrier.name,
    carrierCode: target.carrierCode,
    trackingUrl: target.carrierCode === "AUTO" ? undefined : carrier.trackingUrl(target.number),
    lookupUnavailable: true,
    events: []
  };
};

/** Carriers keep their own 12 s caps (frozen delivery.ts); the route stops waiting when the deadline ends. */
const settleDelivery = (target: LookupTarget, deadline: LookupDeadline): Promise<DeliveryLookupResult> => {
  const lookup = fetchDeliveryTracking(target.number, target.carrierCode).catch(() => unavailableDelivery(target));
  const expired = deadline.whenExpired().then(() => unavailableDelivery(target));
  return Promise.race([lookup, expired]);
};

interface FallbackResult {
  readonly events: TrackingEvent[];
  /** False when customstrack timed out or failed: its "no events" is then not an answer. */
  readonly ok: boolean;
}

const fetchCustomstrackWithin = async (number: string, deadline: LookupDeadline): Promise<FallbackResult> => {
  const capMs = Math.min(LOOKUP_TIMING.customstrackMs, deadline.remainingMs());
  if (capMs <= 0) return { events: [], ok: false };
  try {
    return { events: await fetchCustomstrackCustomsEvents(number, { timeoutMs: capMs, signal: deadline.signal(capMs) }), ok: true };
  } catch {
    return { events: [], ok: false };
  }
};

/** UNI-PASS first; customstrack starts as soon as the first UNI-PASS wave came back empty. Never rejects. */
const lookupCustomsWithFallback = async (
  target: LookupTarget,
  deadline: LookupDeadline,
  tally: UnipassTally
): Promise<CustomsOutcome> => {
  let fallback: Promise<FallbackResult> | null = null;
  const startFallback = (): Promise<FallbackResult> => {
    const current = fallback ?? fetchCustomstrackWithin(target.number, deadline);
    fallback = current;
    return current;
  };
  const unipass = await lookupCustomsEvents(target.number, target.type, {
    deadline,
    onUnipassCall: tally.record,
    onFirstWaveEmpty: () => {
      void startFallback();
    }
  });
  if (unipass.kind === "found") return { unipass, events: unipass.events, answeredEmpty: false };
  const fallbackResult = await startFallback();
  return {
    unipass,
    events: fallbackResult.events,
    answeredEmpty: unipass.kind === "empty" && unipass.complete && fallbackResult.ok
  };
};

const successOutcome = (
  target: LookupTarget,
  customsEvents: TrackingEvent[],
  deliveryLookup: DeliveryLookupResult,
  kind: LookupResultKind
): RouteOutcome => {
  const data = normalizeTrackingData({ trackingNumber: target.number, type: target.type, customsEvents, deliveryLookup });
  const cacheable = shouldCacheTrackResult({
    type: target.type,
    customsEvents,
    deliveryEvents: deliveryLookup.events,
    lookupUnavailable: deliveryLookup.lookupUnavailable === true,
    ambiguous: deliveryLookup.ambiguous === true
  });
  if (cacheable) setCache(target.cacheKey, data, LOOKUP_CACHE_SECONDS.result);
  return { response: successResponse(data), kind, code: null };
};

const pendingOutcome = (target: LookupTarget, customs: CustomsOutcome, deliveryLookup: DeliveryLookupResult): RouteOutcome => {
  const data = normalizeTrackingData({ trackingNumber: target.number, type: target.type, customsEvents: [], deliveryLookup });
  if (customs.answeredEmpty) {
    setCache(target.cacheKey, data, LOOKUP_CACHE_SECONDS.pending);
  }
  return { response: successResponse(data), kind: "pending", code: null };
};

const resolveCustomsOnly = async (target: LookupTarget, deadline: LookupDeadline, tally: UnipassTally): Promise<RouteOutcome> => {
  const customs = await lookupCustomsWithFallback(target, deadline, tally);
  if (customs.events.length > 0) return successOutcome(target, customs.events, autoDelivery(), "found");
  if (customs.unipass.kind === "unavailable") return allFailedOutcome(customs.unipass.timedOut);
  if (customs.answeredEmpty) {
    setCache(notFoundCacheKey(target.cacheKey), true, LOOKUP_CACHE_SECONDS.notFound);
  }
  return notFoundOutcome("notFound");
};

const domesticWithoutCarrierEvents = (
  target: LookupTarget,
  customs: CustomsOutcome,
  deliveryLookup: DeliveryLookupResult
): RouteOutcome => {
  if (customs.events.length > 0) return successOutcome(target, customs.events, deliveryLookup, "found");
  if (deliveryLookup.ambiguous) return successOutcome(target, [], deliveryLookup, "ambiguous");
  if (deliveryLookup.lookupUnavailable) return successOutcome(target, [], deliveryLookup, "lookupUnavailable");
  if (customs.unipass.kind === "unavailable") return allFailedOutcome(customs.unipass.timedOut);
  return pendingOutcome(target, customs, deliveryLookup);
};

/** Carrier-first: once a carrier has events, customs gets a short grace period and is not waited for beyond it. */
const resolveDomestic = async (target: LookupTarget, deadline: LookupDeadline, tally: UnipassTally): Promise<RouteOutcome> => {
  const customsLookup = lookupCustomsWithFallback(target, deadline, tally);
  const deliveryLookup = await settleDelivery(target, deadline);
  if (deliveryLookup.events.length === 0) {
    return domesticWithoutCarrierEvents(target, await customsLookup, deliveryLookup);
  }
  const customs = await withinMs(
    customsLookup,
    Math.min(LOOKUP_TIMING.customsGraceAfterCarrierMs, deadline.remainingMs())
  );
  const customsEvents = customs?.events ?? [];
  return successOutcome(target, customsEvents, deliveryLookup, customsEvents.length > 0 ? "found" : "carrierFirst");
};

const readTarget = async (request: Request): Promise<LookupTarget | null> => {
  const rawBody = await readRequestTextWithLimit(request, 1024, 5000);
  const body: unknown = JSON.parse(rawBody);
  const parsed = TrackRequestSchema.parse(body);
  const identified = identifyTrackingNumber(parsed.trackingNumber);
  if (identified.type === "UNKNOWN") return null;
  return {
    number: identified.number,
    type: identified.type,
    carrierCode: parsed.carrierCode,
    cacheKey: buildTrackCacheKey(identified.type, identified.number, parsed.carrierCode)
  };
};

const handleLookup = async (request: Request, deadline: LookupDeadline, tally: UnipassTally): Promise<RouteOutcome> => {
  const target = await readTarget(request);
  if (!target) return errorOutcome(INVALID_NUMBER_ERROR, 400, "invalid");
  const cached = readCachedOutcome(target.cacheKey);
  if (cached) return cached;
  return target.type === "DOMESTIC" ? resolveDomestic(target, deadline, tally) : resolveCustomsOnly(target, deadline, tally);
};

const rejectBeforeLookup = (request: Request): RouteOutcome | null => {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return errorOutcome({ code: "INVALID_NUMBER", message: "JSON 요청만 지원합니다" }, 415, "invalid");
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 1024) {
    return errorOutcome({ code: "INVALID_NUMBER", message: "요청 내용이 너무 큽니다" }, 413, "invalid");
  }

  if (!consumeRequestQuota(request) || !acquireRequestSlot()) {
    return errorOutcome(
      { code: "RATE_LIMITED", message: "조회 요청이 많습니다. 잠시 후 다시 시도해주세요" },
      429,
      "rateLimited"
    );
  }

  return null;
};

const outcomeForError = (error: unknown): RouteOutcome => {
  if (error instanceof Error && error.name === "RequestBodyTooLargeError") {
    return errorOutcome({ code: "INVALID_NUMBER", message: "요청 내용이 너무 큽니다" }, 413, "invalid");
  }
  if (error instanceof Error && error.name === "RequestBodyTimeoutError") {
    return errorOutcome({ code: "INVALID_NUMBER", message: "요청 본문을 제시간에 받지 못했습니다" }, 408, "invalid");
  }
  if (error instanceof SyntaxError) {
    return errorOutcome({ code: "INVALID_NUMBER", message: "요청 형식을 확인해주세요" }, 400, "invalid");
  }
  if (error instanceof ZodError) {
    return errorOutcome(
      { code: "INVALID_NUMBER", message: error.issues[0]?.message ?? "입력값을 확인해주세요" },
      400,
      "invalid"
    );
  }
  if (isExternalFetchError(error)) {
    return errorOutcome({ code: "API_TIMEOUT", message: TEMPORARY_FAILURE_MESSAGE }, 504, "error");
  }
  if (error instanceof Error && error.name === "CarrierUnavailableError") {
    return errorOutcome(
      {
        code: "API_TIMEOUT",
        message: "현재 택배사 조회 시스템 점검으로 배송정보 조회가 지연되고 있습니다. 잠시 후 다시 시도해주세요"
      },
      503,
      "error"
    );
  }
  return errorOutcome({ code: "SERVER_ERROR", message: "시스템 오류가 발생했습니다. 관리자에게 문의해주세요" }, 500, "error");
};

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();
  const tally = createUnipassTally();
  const finish = (outcome: RouteOutcome): Response => {
    const counts = tally.snapshot();
    logLookup({
      route: "/api/track",
      elapsedBucket: elapsedBucket(Date.now() - startedAt),
      unipassOk: counts.ok,
      unipassFail: counts.fail,
      resultKind: outcome.kind,
      errorCode: outcome.code
    });
    return outcome.response;
  };

  const rejected = rejectBeforeLookup(request);
  if (rejected) return finish(rejected);

  const deadline = createLookupDeadline();
  try {
    return finish(await handleLookup(request, deadline, tally));
  } catch (error) {
    return finish(outcomeForError(error));
  } finally {
    deadline.cancel();
    releaseRequestSlot();
  }
}
