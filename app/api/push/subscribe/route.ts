import { NextResponse } from "next/server";
import { z } from "zod";
import { PushSubscriptionSchema, redisConfig, savePushRecord } from "@/lib/push/store";
import { consumeRequestQuota } from "@/lib/rate-limit";
import { readRequestTextWithLimit } from "@/lib/services/http";
import { identifyTrackingNumber } from "@/lib/services/identifier";

/** 통관 완료 알림 신청 (11월 28일 요청): keeps the number and this browser's push subscription for up to 14 days. */

const SubscribeSchema = z.object({
  trackingNumber: z.string().min(1).max(30).trim(),
  subscription: PushSubscriptionSchema
});

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

const reply = (status: number, message?: string): Response =>
  NextResponse.json(status === 200 ? { success: true } : { success: false, error: { message } }, { status, headers: NO_STORE });

export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply(415, "JSON 요청만 받아요");
  if (!consumeRequestQuota(request)) return reply(429, "요청이 많아요. 잠시 후 다시 시도해 주세요");
  const config = redisConfig();
  if (config === null) return reply(503, "알림 기능을 준비하고 있어요");

  let body: unknown;
  try {
    body = JSON.parse(await readRequestTextWithLimit(request, 4096, 5000));
  } catch {
    return reply(400, "요청 형식을 확인해 주세요");
  }
  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) return reply(400, "알림 신청 정보를 확인해 주세요");
  const identified = identifyTrackingNumber(parsed.data.trackingNumber);
  if (identified.type === "UNKNOWN") return reply(400, "번호 형식을 확인해 주세요");

  try {
    await savePushRecord(config, { number: identified.number, subscription: parsed.data.subscription });
  } catch (error) {
    console.error("push_subscribe_failed", error instanceof Error ? error.message : "unknown");
    return reply(503, "알림 신청을 저장하지 못했어요. 잠시 후 다시 시도해 주세요");
  }
  return reply(200);
}
