import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * Clearance-alert subscriptions (11월 28일 요청: 웹 푸시 통관 완료 알림). One Redis key per device and number, holding
 * only the number and the browser's push subscription; it expires on its own after 14 days and is deleted once the
 * alert is sent. Upstash REST (Vercel Marketplace) through fetch — no client library.
 */

export const PUSH_TTL_SECONDS = 14 * 24 * 60 * 60;
const KEY_PREFIX = "push:";
const SCAN_COUNT = 200;

/** The server POSTs to the endpoint, so only the browsers' own push services are accepted (no SSRF to other hosts). */
const PUSH_SERVICE_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^web\.push\.apple\.com$/];

export function isPushServiceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.port === "" && PUSH_SERVICE_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

export const PushSubscriptionSchema = z.object({
  endpoint: z.string().max(1024).refine(isPushServiceUrl, "지원하지 않는 알림 서비스예요"),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(128) })
});
export type StoredPushSubscription = z.infer<typeof PushSubscriptionSchema>;

const PushRecordSchema = z.object({ number: z.string().min(1).max(40), subscription: PushSubscriptionSchema });
export type PushRecord = z.infer<typeof PushRecordSchema>;

interface RedisConfig {
  readonly url: string;
  readonly token: string;
}

/** Vercel's Upstash integration names (KV_*) first, then Upstash's own. */
export function redisConfig(env: Readonly<Record<string, string | undefined>> = process.env): RedisConfig | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(config: RedisConfig, command: readonly (string | number)[]): Promise<unknown> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000)
  });
  const body: unknown = await response.json();
  if (!response.ok || typeof body !== "object" || body === null || "error" in body) {
    throw new Error(`Redis ${String(command[0])} 실패: ${response.status}`);
  }
  return (body as { result: unknown }).result;
}

/** The same device asking twice for the same number keeps one key. */
export function pushKey(number: string, endpoint: string): string {
  return `${KEY_PREFIX}${createHash("sha256").update(`${number}\n${endpoint}`).digest("hex").slice(0, 32)}`;
}

export async function savePushRecord(config: RedisConfig, record: PushRecord): Promise<void> {
  await redis(config, ["SET", pushKey(record.number, record.subscription.endpoint), JSON.stringify(record), "EX", PUSH_TTL_SECONDS]);
}

export async function deletePushRecord(config: RedisConfig, key: string): Promise<void> {
  await redis(config, ["DEL", key]);
}

/** Every live record with its key, up to `limit`. Unreadable values are dropped (and expire on their own). */
export async function listPushRecords(config: RedisConfig, limit: number): Promise<ReadonlyArray<{ key: string; record: PushRecord }>> {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const result = await redis(config, ["SCAN", cursor, "MATCH", `${KEY_PREFIX}*`, "COUNT", SCAN_COUNT]);
    const [next, batch] = z.tuple([z.string(), z.array(z.string())]).parse(result);
    keys.push(...batch);
    cursor = next;
  } while (cursor !== "0" && keys.length < limit);
  const picked = [...new Set(keys)].slice(0, limit);
  if (picked.length === 0) return [];
  const values = z.array(z.string().nullable()).parse(await redis(config, ["MGET", ...picked]));
  return picked.flatMap((key, index) => {
    const raw = values[index];
    if (raw === null || raw === undefined) return [];
    try {
      const parsed = PushRecordSchema.safeParse(JSON.parse(raw));
      return parsed.success ? [{ key, record: parsed.data }] : [];
    } catch {
      return [];
    }
  });
}
