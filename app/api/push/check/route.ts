import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import webpush from "web-push";
import { checkSubscriptions } from "@/lib/push/check";
import { deletePushRecord, listPushRecords, redisConfig } from "@/lib/push/store";
import { lookupCustomsEvents } from "@/lib/services/customs";
import { identifyTrackingNumber } from "@/lib/services/identifier";
import { createLookupDeadline } from "@/lib/services/lookup-budget";

/**
 * Runs every 15 minutes from GitHub Actions (.github/workflows/push-check.yml) with `Authorization: Bearer
 * PUSH_CRON_SECRET`: looks up every subscribed number and sends the 통관 완료 alert once customs cleared it.
 */

export const maxDuration = 60;
/** Stop starting new numbers here; the last lookup still fits in maxDuration. */
const WORK_BUDGET_MS = 40_000;
// ponytail: one pass handles at most 300 subscriptions; page through SCAN across runs if the store grows past that.
const MAX_RECORDS = 300;
const PUSH_TTL_SECONDS = 24 * 60 * 60;

const isAuthorized = (request: Request, secret: string): boolean => {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
};

async function isCleared(number: string): Promise<boolean | null> {
  const identified = identifyTrackingNumber(number);
  if (identified.type === "UNKNOWN") return null;
  const deadline = createLookupDeadline();
  try {
    const result = await lookupCustomsEvents(identified.number, identified.type, { deadline });
    if (result.kind !== "found") return null;
    return result.events.some((event) => event.statusCode >= 4);
  } finally {
    deadline.cancel();
  }
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.PUSH_CRON_SECRET;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const config = redisConfig();
  if (!secret || !isAuthorized(request, secret)) return new NextResponse("Not Found", { status: 404 });
  if (!publicKey || !privateKey || config === null) {
    return NextResponse.json({ success: false, error: { message: "push not configured" } }, { status: 503 });
  }

  const startedAt = Date.now();
  const vapidDetails = { subject: "https://tracking.tipoasis.com", publicKey, privateKey };
  const records = await listPushRecords(config, MAX_RECORDS);
  const summary = await checkSubscriptions(records, {
    isCleared,
    send: async (subscription, payload) => {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload), { vapidDetails, TTL: PUSH_TTL_SECONDS, urgency: "high" });
        return true;
      } catch {
        return false;
      }
    },
    remove: (key) => deletePushRecord(config, key),
    outOfTime: () => Date.now() - startedAt > WORK_BUDGET_MS
  });
  console.info("push_check", JSON.stringify({ records: records.length, ...summary }));
  return NextResponse.json({ success: true, data: { records: records.length, ...summary } }, { headers: { "Cache-Control": "no-store" } });
}
