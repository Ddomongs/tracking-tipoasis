import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCache, setCache, buildTrackCacheKey } from "@/lib/cache";
import { TrackRequestSchema } from "@/lib/schemas";
import { fetchCustomsEvents } from "@/lib/services/customs";
import { fetchDeliveryEvents } from "@/lib/services/delivery";
import { identifyTrackingNumber } from "@/lib/services/identifier";
import { normalizeTrackingData } from "@/lib/services/normalizer";
import type { ApiError, TrackResponseData, TrackingEvent } from "@/lib/types";

const errorResponse = (error: ApiError, status = 400) =>
  NextResponse.json(
    {
      success: false,
      error
    },
    { status }
  );

const isExternalFetchError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "AbortError" || error.message.includes("fetch failed") || error.message.includes("UND_ERR"));

export async function POST(request: Request) {
  try {
    const body = await request.json();
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

    const cacheKey = buildTrackCacheKey(identified.type, identified.number);
    const cached = getCache<TrackResponseData>(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, data: cached });
    }

    let customsEvents: TrackingEvent[] = [];
    let deliveryEvents: TrackingEvent[] = [];

    if (identified.type === "DOMESTIC") {
      try {
        customsEvents = await fetchCustomsEvents(identified.number, "DOMESTIC");
      } catch (error) {
        if (!isExternalFetchError(error)) {
          throw error;
        }
      }

      try {
        deliveryEvents = await fetchDeliveryEvents(identified.number);
      } catch (error) {
        if (!(error instanceof Error && error.name === "CarrierUnavailableError" && customsEvents.length > 0)) {
          throw error;
        }
      }
    } else {
      customsEvents = await fetchCustomsEvents(identified.number, identified.type);
    }

    if (customsEvents.length === 0 && deliveryEvents.length === 0) {
      if (identified.type === "DOMESTIC") {
        return errorResponse(
          {
            code: "NOT_FOUND",
            message: "아직 배송중인가봅니다. 판매처에게 문의해주세요!"
          },
          404
        );
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
      deliveryEvents
    });

    setCache(cacheKey, normalized, 900);

    return NextResponse.json({ success: true, data: normalized });
  } catch (error) {
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
  }
}
