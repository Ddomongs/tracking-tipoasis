import { expect, test } from "@playwright/test";
import { POST as subscribePost } from "@/app/api/push/subscribe/route";
import { checkSubscriptions, clearedPayload } from "@/lib/push/check";
import { pushSupport, vapidKeyBytes } from "@/lib/push/client";
import { isPushServiceUrl, listPushRecords, pushKey, redisConfig, type PushRecord } from "@/lib/push/store";
import { FAKE } from "../fixtures/tracking-fixtures";

// 11월 28일 요청: 통관 완료 웹 푸시 알림.

const subscription = (endpoint = "https://fcm.googleapis.com/fcm/send/abc") => ({ endpoint, keys: { p256dh: "p", auth: "a" } });
const record = (number: string, endpoint?: string): { key: string; record: PushRecord } => ({
  key: pushKey(number, subscription(endpoint).endpoint),
  record: { number, subscription: subscription(endpoint) }
});

test.describe("push endpoints", () => {
  test("only the browsers' own push services are accepted", () => {
    expect(isPushServiceUrl("https://fcm.googleapis.com/fcm/send/x")).toBe(true);
    expect(isPushServiceUrl("https://web.push.apple.com/QW")).toBe(true);
    expect(isPushServiceUrl("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(isPushServiceUrl("https://wns2-bl2p.notify.windows.com/w/?token=x")).toBe(true);
    expect(isPushServiceUrl("http://fcm.googleapis.com/fcm/send/x")).toBe(false);
    expect(isPushServiceUrl("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isPushServiceUrl("https://evil.example/fcm.googleapis.com")).toBe(false);
    expect(isPushServiceUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isPushServiceUrl("not a url")).toBe(false);
  });

  test("one key per number and device", () => {
    expect(pushKey(FAKE.domestic, "https://fcm.googleapis.com/a")).toBe(pushKey(FAKE.domestic, "https://fcm.googleapis.com/a"));
    expect(pushKey(FAKE.domestic, "https://fcm.googleapis.com/a")).not.toBe(pushKey(FAKE.domestic, "https://fcm.googleapis.com/b"));
    expect(pushKey(FAKE.domestic, "https://fcm.googleapis.com/a")).toMatch(/^push:[0-9a-f]{32}$/);
  });

  test("Redis settings come from Vercel's KV_* names or Upstash's own", () => {
    expect(redisConfig({ KV_REST_API_URL: "https://kv", KV_REST_API_TOKEN: "t" })).toEqual({ url: "https://kv", token: "t" });
    expect(redisConfig({ UPSTASH_REDIS_REST_URL: "https://up", UPSTASH_REDIS_REST_TOKEN: "u" })).toEqual({ url: "https://up", token: "u" });
    expect(redisConfig({})).toBeNull();
  });
});

test.describe("one check pass", () => {
  test("a cleared number notifies every device once and forgets them; waiting numbers stay", async () => {
    const waiting = FAKE.domesticAlt;
    const records = [record(FAKE.domestic, "https://fcm.googleapis.com/1"), record(FAKE.domestic, "https://fcm.googleapis.com/2"), record(waiting)];
    const lookedUp: string[] = [];
    const sent: string[] = [];
    const removed: string[] = [];
    const summary = await checkSubscriptions(records, {
      isCleared: async (number) => {
        lookedUp.push(number);
        return number === FAKE.domestic;
      },
      send: async (sub) => {
        sent.push(sub.endpoint);
        return sub.endpoint.endsWith("/1");
      },
      remove: async (key) => {
        removed.push(key);
      },
      outOfTime: () => false
    });
    expect(lookedUp).toEqual([FAKE.domestic, waiting]);
    expect(sent).toEqual(["https://fcm.googleapis.com/1", "https://fcm.googleapis.com/2"]);
    expect(removed).toEqual([records[0].key, records[1].key]);
    expect(summary).toEqual({ checked: 2, cleared: 1, sent: 1, removed: 2 });
  });

  test("an unknown answer keeps the record, and the time budget stops new lookups", async () => {
    let calls = 0;
    const summary = await checkSubscriptions([record(FAKE.domestic), record(FAKE.domesticAlt)], {
      isCleared: async () => {
        calls += 1;
        return null;
      },
      send: async () => true,
      remove: async () => undefined,
      outOfTime: () => calls >= 1
    });
    expect(summary).toEqual({ checked: 1, cleared: 0, sent: 0, removed: 0 });
  });

  test("the notification shows only the last four digits", () => {
    const payload = clearedPayload(FAKE.domestic);
    expect(payload.body).toContain(FAKE.domestic.slice(-4));
    expect(payload.body).not.toContain(FAKE.domestic);
    expect(payload.url).toBe(`/${FAKE.domestic}`);
  });
});

test.describe("browser support", () => {
  test("ready with service worker and PushManager; iPhone Safari outside the home screen gets the how-to", () => {
    const base = { hasServiceWorker: true, hasPushManager: true, userAgent: "Mozilla/5.0 (Linux; Android 14)", standalone: false };
    expect(pushSupport(base)).toBe("ready");
    const iphone = { hasServiceWorker: true, hasPushManager: false, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", standalone: false };
    expect(pushSupport(iphone)).toBe("iosNeedsHomeScreen");
    expect(pushSupport({ ...iphone, standalone: true })).toBe("unsupported");
    expect(pushSupport({ ...base, hasPushManager: false })).toBe("unsupported");
  });

  test("the VAPID key turns into its raw bytes", () => {
    expect([...vapidKeyBytes("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });
});

test.describe("redis and the subscribe route", () => {
  const originalFetch = globalThis.fetch;
  const env = { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };
  const commands: unknown[][] = [];

  test.beforeEach(() => {
    commands.length = 0;
    process.env.KV_REST_API_URL = "https://kv.stub";
    process.env.KV_REST_API_TOKEN = "stub";
    globalThis.fetch = async (_input, init) => {
      const command = JSON.parse(String(init?.body)) as unknown[];
      commands.push(command);
      if (command[0] === "SCAN") return Response.json({ result: ["0", ["push:a", "push:b", "push:c"]] });
      if (command[0] === "MGET") {
        return Response.json({ result: [JSON.stringify(record(FAKE.domestic).record), null, "{broken"] });
      }
      return Response.json({ result: "OK" });
    };
  });

  test.afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.KV_REST_API_URL = env.url;
    process.env.KV_REST_API_TOKEN = env.token;
  });

  test("listing drops expired and unreadable values", async () => {
    const config = redisConfig();
    expect(config).not.toBeNull();
    if (config === null) return;
    const listed = await listPushRecords(config, 10);
    expect(listed).toEqual([{ key: "push:a", record: record(FAKE.domestic).record }]);
  });

  const subscribeRequest = (body: unknown): Request =>
    new Request("http://localhost/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "203.0.113.9" },
      body: JSON.stringify(body)
    });

  test("a valid request stores the number and subscription for 14 days", async () => {
    const response = await subscribePost(subscribeRequest({ trackingNumber: ` ${FAKE.domestic} `, subscription: subscription() }));
    expect(response.status).toBe(200);
    expect(commands).toEqual([
      ["SET", pushKey(FAKE.domestic, subscription().endpoint), JSON.stringify({ number: FAKE.domestic, subscription: subscription() }), "EX", 1_209_600]
    ]);
  });

  test("other endpoints, bad numbers and non-JSON are refused without storing", async () => {
    expect((await subscribePost(subscribeRequest({ trackingNumber: FAKE.domestic, subscription: subscription("https://evil.example/x") }))).status).toBe(400);
    expect((await subscribePost(subscribeRequest({ trackingNumber: "abc", subscription: subscription() }))).status).toBe(400);
    const plain = new Request("http://localhost/api/push/subscribe", { method: "POST", headers: { "content-type": "text/plain" }, body: "x" });
    expect((await subscribePost(plain)).status).toBe(415);
    expect(commands).toEqual([]);
  });
});
