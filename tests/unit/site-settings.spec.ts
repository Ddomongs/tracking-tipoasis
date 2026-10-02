import { expect, test } from "@playwright/test";
import { channels, resultCopy } from "@/config/site.config";
import {
  DEFAULT_SITE_SETTINGS,
  SITE_SETTINGS_KEY,
  edgeConfigFromConnection,
  mergeSiteSettings,
  validateSiteSettings
} from "@/lib/site-settings/settings";
import { readSiteSettings, saveSiteSettings } from "@/lib/site-settings/store";

/** 10월 2일 요청: 관리자 화면에서 첫 화면 스토어 칸의 링크·버튼 문구를 고치고 Vercel Edge Config에 저장합니다. */
const CONNECTION = "https://edge-config.vercel.com/ecfg_testid?token=read-token";

test("defaults come from config/site.config.ts", () => {
  expect(DEFAULT_SITE_SETTINGS).toEqual({
    storeButtonLabel: "스토어·추천 상품 보기",
    storeTitle: resultCopy.showcaseTitle,
    storeIntro: "베스트 상품과 특가는 스토어에서 바로 볼 수 있어요.",
    naverLabel: channels.naver.linkLabel,
    naverUrl: channels.naver.urls.showcase,
    coupangLabel: channels.coupang.linkLabel,
    coupangUrl: channels.coupang.urls.showcase,
    youtubeLabel: channels.youtube.linkLabel,
    youtubeUrl: channels.youtube.url ?? ""
  });
});

test("validation: trims text, keeps https links on allowed hosts, an empty YouTube link hides it", () => {
  const ok = validateSiteSettings({ ...DEFAULT_SITE_SETTINGS, storeTitle: "  추천 모음  ", youtubeUrl: "https://www.youtube.com/@test" });
  expect(ok.ok).toBe(true);
  if (ok.ok) expect(ok.value.storeTitle).toBe("추천 모음");
  const bad = validateSiteSettings({
    ...DEFAULT_SITE_SETTINGS,
    storeButtonLabel: " ",
    naverUrl: "http://smartstore.naver.com/x",
    coupangUrl: "https://evil.example.com/",
    youtubeUrl: "javascript:alert(1)"
  });
  expect(bad.ok).toBe(false);
  if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["coupangUrl", "naverUrl", "storeButtonLabel", "youtubeUrl"]);
  expect(validateSiteSettings({ ...DEFAULT_SITE_SETTINGS, youtubeUrl: "" }).ok).toBe(true);
  expect(validateSiteSettings({ ...DEFAULT_SITE_SETTINGS, storeIntro: "가".repeat(121) }).ok).toBe(false);
  expect(validateSiteSettings("nope").ok).toBe(false);
});

test("merge: stored values win field by field; unknown or broken fields fall back to the defaults", () => {
  expect(mergeSiteSettings({ storeTitle: "새 제목", naverUrl: "https://evil.example.com/", extra: 1 })).toEqual({
    ...DEFAULT_SITE_SETTINGS,
    storeTitle: "새 제목"
  });
  expect(mergeSiteSettings(null)).toEqual(DEFAULT_SITE_SETTINGS);
  expect(mergeSiteSettings([1, 2])).toEqual(DEFAULT_SITE_SETTINGS);
});

test("the Edge Config connection string gives the store id and the read token", () => {
  expect(edgeConfigFromConnection(CONNECTION)).toEqual({ id: "ecfg_testid", token: "read-token" });
  expect(edgeConfigFromConnection(undefined)).toBeNull();
  expect(edgeConfigFromConnection("https://example.com/ecfg_x?token=t")).toBeNull();
  expect(edgeConfigFromConnection("https://edge-config.vercel.com/ecfg_x")).toBeNull();
});

test("read: no store → defaults without a request; a stored item is merged; any failure → defaults", async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetcher = (answer: () => Response) => async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    return answer();
  };
  expect(await readSiteSettings({ env: {}, fetcher: fetcher(() => new Response("{}")) })).toEqual({ settings: DEFAULT_SITE_SETTINGS, source: "defaults" });
  expect(calls).toEqual([]);
  const env = { EDGE_CONFIG: CONNECTION };
  const stored = await readSiteSettings({ env, fetcher: fetcher(() => Response.json({ storeTitle: "저장된 제목" })) });
  expect(stored).toEqual({ settings: { ...DEFAULT_SITE_SETTINGS, storeTitle: "저장된 제목" }, source: "edgeConfig" });
  expect(calls[0]?.url).toBe(`https://edge-config.vercel.com/ecfg_testid/item/${SITE_SETTINGS_KEY}`);
  expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer read-token");
  await readSiteSettings({ env, fresh: true, fetcher: fetcher(() => Response.json({})) });
  expect(calls.at(-1)?.init?.cache).toBe("no-store");
  expect(await readSiteSettings({ env, fetcher: fetcher(() => new Response("missing", { status: 404 })) })).toEqual({
    settings: DEFAULT_SITE_SETTINGS,
    source: "edgeConfig"
  });
  expect(await readSiteSettings({ env, fetcher: fetcher(() => new Response("oops", { status: 500 })) })).toEqual({
    settings: DEFAULT_SITE_SETTINGS,
    source: "error"
  });
  const throwing = async (): Promise<Response> => {
    throw new Error("offline");
  };
  expect((await readSiteSettings({ env, fetcher: throwing })).source).toBe("error");
});

test("stored values reach the page: labels and links are merged and links are normalized", async () => {
  const env = { EDGE_CONFIG: CONNECTION };
  const { settings } = await readSiteSettings({
    env,
    fetcher: async () => Response.json({ storeButtonLabel: "특가 보기", naverUrl: "https://SMARTSTORE.naver.com/shop", youtubeUrl: "https://www.youtube.com/@test" })
  });
  expect(settings.storeButtonLabel).toBe("특가 보기");
  expect(settings.naverUrl).toBe("https://smartstore.naver.com/shop");
  expect(settings.youtubeUrl).toBe("https://www.youtube.com/@test");
});

test("allowlist edge cases never pass", () => {
  for (const url of [
    "https://smartstore.naver.com.evil.com/",
    "https://evil.com/smartstore.naver.com",
    "https://a@evil.com/",
    "https://smartstore.naver.com./x",
    "//smartstore.naver.com/x"
  ]) {
    expect(validateSiteSettings({ ...DEFAULT_SITE_SETTINGS, naverUrl: url }).ok, url).toBe(false);
  }
});

test("save: needs the store and a Vercel API token, then upserts one item", async () => {
  const value = { ...DEFAULT_SITE_SETTINGS, storeTitle: "새 제목" };
  expect(await saveSiteSettings(value, { env: { EDGE_CONFIG: CONNECTION }, fetcher: async () => new Response() })).toEqual({ ok: false, reason: "notConfigured" });
  let request: { url: string; init: RequestInit | undefined } | null = null;
  const fetcher = async (url: string, init?: RequestInit): Promise<Response> => {
    request = { url, init };
    return Response.json({ status: "ok" });
  };
  const env = { EDGE_CONFIG: CONNECTION, VERCEL_API_TOKEN: "api-token", VERCEL_TEAM_ID: "team_x" };
  expect(await saveSiteSettings(value, { env, fetcher })).toEqual({ ok: true });
  expect(request).not.toBeNull();
  const sent = request as unknown as { url: string; init: RequestInit };
  expect(sent.url).toBe("https://api.vercel.com/v1/edge-config/ecfg_testid/items?teamId=team_x");
  expect(sent.init.method).toBe("PATCH");
  expect(new Headers(sent.init.headers).get("authorization")).toBe("Bearer api-token");
  expect(JSON.parse(String(sent.init.body))).toEqual({ items: [{ operation: "upsert", key: SITE_SETTINGS_KEY, value }] });
  expect(await saveSiteSettings(value, { env, fetcher: async () => new Response("no", { status: 403 }) })).toEqual({ ok: false, reason: "rejected" });
});
