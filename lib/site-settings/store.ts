import { SITE_SETTINGS_KEY, DEFAULT_SITE_SETTINGS, edgeConfigFromConnection, mergeSiteSettings, type SiteSettings } from "./settings";

/**
 * Server-side access to the stored site settings (Vercel Global Config, formerly Edge Config; 10월 2일 요청). Environment:
 * GLOBAL_CONFIG (read; added by Vercel when the store is connected — EDGE_CONFIG is the older name), VERCEL_API_TOKEN
 * (write) and VERCEL_TEAM_ID (the team that owns the store). Reads never throw: without a store, or on any error, the
 * page uses the config defaults.
 */
type Env = Readonly<Record<string, string | undefined>>;

function connectionOf(env: Env): ReturnType<typeof edgeConfigFromConnection> {
  return edgeConfigFromConnection(env.GLOBAL_CONFIG ?? env.EDGE_CONFIG);
}
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

interface StoreOptions {
  readonly env?: Env;
  readonly fetcher?: Fetcher;
  /** The admin screen reads past the page cache so it never edits a stale copy. */
  readonly fresh?: boolean;
}

const READ_TIMEOUT_MS = 1500;
/** Pages re-read the item with the home page's 5-minute ISR window; a save revalidates them at once. */
const READ_REVALIDATE_SECONDS = 300;

export type SiteSettingsSource = "defaults" | "edgeConfig" | "error";

export async function readSiteSettings(
  options: StoreOptions = {}
): Promise<{ readonly settings: SiteSettings; readonly source: SiteSettingsSource }> {
  const env = options.env ?? process.env;
  const store = connectionOf(env);
  if (store === null) return { settings: DEFAULT_SITE_SETTINGS, source: "defaults" };
  const fetcher: Fetcher = options.fetcher ?? fetch;
  try {
    // The read token goes in a header, not the URL, so it stays out of cache keys and fetch logs.
    const response = await fetcher(`https://${store.host}/${store.id}/item/${SITE_SETTINGS_KEY}`, {
      headers: { authorization: `Bearer ${store.token}` },
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
      ...(options.fresh === true ? { cache: "no-store" as const } : { next: { revalidate: READ_REVALIDATE_SECONDS } })
    });
    if (response.status === 404) return { settings: DEFAULT_SITE_SETTINGS, source: "edgeConfig" };
    if (!response.ok) return { settings: DEFAULT_SITE_SETTINGS, source: "error" };
    return { settings: mergeSiteSettings(await response.json()), source: "edgeConfig" };
  } catch {
    return { settings: DEFAULT_SITE_SETTINGS, source: "error" };
  }
}

export type SaveResult = { readonly ok: true } | { readonly ok: false; readonly reason: "notConfigured" | "rejected" | "network" };

export function canSaveSiteSettings(env: Env = process.env): boolean {
  return connectionOf(env) !== null && Boolean(env.VERCEL_API_TOKEN);
}

/** Upserts the whole (already validated) settings item through the Vercel REST API. */
export async function saveSiteSettings(value: SiteSettings, options: StoreOptions = {}): Promise<SaveResult> {
  const env = options.env ?? process.env;
  const store = connectionOf(env);
  const token = env.VERCEL_API_TOKEN;
  if (store === null || !token) return { ok: false, reason: "notConfigured" };
  const team = env.VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}` : "";
  const fetcher: Fetcher = options.fetcher ?? fetch;
  try {
    const response = await fetcher(`https://api.vercel.com/v1/global-config/${store.id}/items${team}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ items: [{ operation: "upsert", key: SITE_SETTINGS_KEY, value }] }),
      signal: AbortSignal.timeout(8000)
    });
    if (response.ok) return { ok: true };
    console.warn(`site_settings_save {"status":${response.status}}`);
    return { ok: false, reason: "rejected" };
  } catch {
    console.warn('site_settings_save {"status":"network"}');
    return { ok: false, reason: "network" };
  }
}
