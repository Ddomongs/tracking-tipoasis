import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCache, setCache, buildTrackCacheKey } from "@/lib/cache";
import { getDeliveryCarrier } from "@/lib/delivery-carriers";
import { TrackRequestSchema } from "@/lib/schemas";
import { acquireRequestSlot, consumeRequestQuota, releaseRequestSlot } from "@/lib/rate-limit";
import { fetchCustomsEvents } from "@/lib/services/customs";
import { fetchCustomstrackCustomsEvents } from "@/lib/services/customstrack";
import { fetchDeliveryTracking } from "@/lib/services/delivery";
import { readRequestTextWithLimit } from "@/lib/services/http";
import { identifyTrackingNumber } from "@/lib/services/identifier";
import { normalizeTrackingData } from "@/lib/services/normalizer";
import type {
  ApiError,
  DeliveryCarrierCode,
  DeliveryLookupResult,
  TrackResponseData,
  TrackingEvent
} from "@/lib/types";

export const preferredRegion = "icn1";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0"
};

const errorResponse = (error: ApiError, status = 400) =>
  NextResponse.json(
    {
      success: false,
      error
    },
    {
      status,
      headers: noStoreHeaders
    }
  );

const successResponse = (data: TrackResponseData) =>
  NextResponse.json(
    {
      success: true,
      data
    },
    {
      headers: noStoreHeaders
    }
  );

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

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const fetchCustomstrackBestEffort = async (trackingNumber: string): Promise<TrackingEvent[]> => {
  try {
    return await fetchCustomstrackCustomsEvents(trackingNumber);
  } catch {
    console.warn("Customstrack fallback lookup unavailable");
    return [];
  }
};

const fetchCustomsEventsWithRetry = async (
  trackingNumber: string,
  type: "DOMESTIC" | "HBL" | "CARGO",
  attempts = 3
): Promise<TrackingEvent[]> => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const events = await fetchCustomsEvents(trackingNumber, type);
      if (events.length > 0 || attempt === attempts) return events;
    } catch (error) {
      if (!isExternalFetchError(error) || attempt === attempts) {
        throw error;
      }
    }

    await wait(500);
  }

  return [];
};

const resolveDomesticLookups = async (
  trackingNumber: string,
  carrierCode: DeliveryCarrierCode
): Promise<{
  customsEvents: TrackingEvent[];
  deliveryLookup: DeliveryLookupResult;
}> => {
  const [customsResult, deliveryResult] = await Promise.allSettled([
    fetchCustomsEventsWithRetry(trackingNumber, "DOMESTIC"),
    fetchDeliveryTracking(trackingNumber, carrierCode)
  ]);

  if (customsResult.status === "rejected" && !isExternalFetchError(customsResult.reason)) {
    throw customsResult.reason;
  }

  const unipassEvents = customsResult.status === "fulfilled" ? customsResult.value : [];
  const customsEvents = unipassEvents.length > 0 ? unipassEvents : await fetchCustomstrackBestEffort(trackingNumber);

  if (deliveryResult.status === "fulfilled") return { customsEvents, deliveryLookup: deliveryResult.value };

  const carrier = getDeliveryCarrier(carrierCode);
  return {
    customsEvents,
    deliveryLookup: {
      carrier: carrier.name,
      carrierCode,
      trackingUrl: carrierCode === "AUTO" ? undefined : carrier.trackingUrl(trackingNumber),
      lookupUnavailable: true,
      events: []
    }
  };
};

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return errorResponse({ code: "INVALID_NUMBER", message: "JSON 요청만 지원합니다" }, 415);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 1024) {
    return errorResponse({ code: "INVALID_NUMBER", message: "요청 내용이 너무 큽니다" }, 413);
  }

  if (!consumeRequestQuota(request) || !acquireRequestSlot()) {
    return errorResponse({ code: "RATE_LIMITED", message: "조회 요청이 많습니다. 잠시 후 다시 시도해주세요" }, 429);
  }

  try {
    const rawBody = await readRequestTextWithLimit(request, 1024, 5000);
    const body: unknown = JSON.parse(rawBody);
    const parsed = TrackRequestSchema.parse(body);
    const identified = identifyTrackingNumber(parsed.trackingNumber);

    if (identified.type === "UNKNOWN") {
      return errorResponse(
        {
          code: "INVALID_NUMBER",
          message:
            "입력하신 번호의 형식을 확인할 수 없습니다. HBL/화물관리번호/국내 운송장 번호를 다시 확인해주세요."
        },
        400
      );
    }

    const cacheKey = buildTrackCacheKey(identified.type, identified.number, parsed.carrierCode);
    const cached = getCache<TrackResponseData>(cacheKey);
    if (cached) {
      return successResponse(cached);
    }

    let customsEvents: TrackingEvent[] = [];
    let deliveryLookup: DeliveryLookupResult = {
      carrier: getDeliveryCarrier("AUTO").name,
      carrierCode: "AUTO",
      events: []
    };

    if (identified.type === "DOMESTIC") {
      const domesticLookups = await resolveDomesticLookups(identified.number, parsed.carrierCode);
      customsEvents = domesticLookups.customsEvents;
      deliveryLookup = domesticLookups.deliveryLookup;
    } else {
      customsEvents = await fetchCustomsEventsWithRetry(identified.number, identified.type);

      if (customsEvents.length === 0) {
        customsEvents = await fetchCustomstrackBestEffort(identified.number);
      }
    }

    if (customsEvents.length === 0 && deliveryLookup.events.length === 0) {
      if (identified.type === "DOMESTIC") {
        const pending = normalizeTrackingData({
          trackingNumber: identified.number,
          type: identified.type,
          customsEvents,
          deliveryLookup
        });

        if (!deliveryLookup.lookupUnavailable && !deliveryLookup.ambiguous) setCache(cacheKey, pending, 300);

        return successResponse(pending);
      }

      return errorResponse(
        {
          code: "NOT_FOUND",
          message: "해당 번호로 통관/배송 정보를 찾을 수 없습니다"
        },
        404
      );
    }

    const normalized = normalizeTrackingData({
      trackingNumber: identified.number,
      type: identified.type,
      customsEvents,
      deliveryLookup
    });

    if (
      shouldCacheTrackResult({
        type: identified.type,
        customsEvents,
        deliveryEvents: deliveryLookup.events,
        lookupUnavailable: deliveryLookup.lookupUnavailable === true,
        ambiguous: deliveryLookup.ambiguous === true
      })
    ) {
      setCache(cacheKey, normalized, 900);
    }

    return successResponse(normalized);
  } catch (error) {
    if (error instanceof Error && error.name === "RequestBodyTooLargeError") {
      return errorResponse({ code: "INVALID_NUMBER", message: "요청 내용이 너무 큽니다" }, 413);
    }

    if (error instanceof Error && error.name === "RequestBodyTimeoutError") {
      return errorResponse({ code: "INVALID_NUMBER", message: "요청 본문을 제시간에 받지 못했습니다" }, 408);
    }

    if (error instanceof SyntaxError) {
      return errorResponse(
        {
          code: "INVALID_NUMBER",
          message: "요청 형식을 확인해주세요"
        },
        400
      );
    }

    if (error instanceof ZodError) {
      return errorResponse(
        {
          code: "INVALID_NUMBER",
          message: error.issues[0]?.message ?? "입력값을 확인해주세요"
        },
        400
      );
    }

    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse(
        {
          code: "API_TIMEOUT",
          message: "조회 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요"
        },
        504
      );
    }

    if (isExternalFetchError(error)) {
      return errorResponse(
        {
          code: "API_TIMEOUT",
          message: "조회 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요"
        },
        504
      );
    }

    if (error instanceof Error && error.name === "CarrierUnavailableError") {
      return errorResponse(
        {
          code: "API_TIMEOUT",
          message: "현재 택배사 조회 시스템 점검으로 배송정보 조회가 지연되고 있습니다. 잠시 후 다시 시도해주세요"
        },
        503
      );
    }

    return errorResponse(
      {
        code: "SERVER_ERROR",
        message: "시스템 오류가 발생했습니다. 관리자에게 문의해주세요"
      },
      500
    );
  } finally {
    releaseRequestSlot();
  }
}
