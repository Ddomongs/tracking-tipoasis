import { z } from "zod";
import { STORE_SHEET_INTRO, STORE_SHEET_OPEN_LABEL } from "@/components/supplementary/store-sheet";
import { channels, resultCopy } from "@/config/site.config";

/**
 * Words and links of the home store sheet and the loading card that staff edit on /internal/cs-helper?tab=site (10월 2일 요청), stored as one
 * Vercel Global Config (formerly Edge Config) item. config/site.config.ts gives the defaults; a missing, unreadable or invalid stored field falls
 * back to its default, so a bad save can never break the page.
 */
export const SITE_SETTINGS_KEY = "siteSettings";

export interface SiteSettings {
  readonly storeButtonLabel: string;
  readonly storeTitle: string;
  readonly storeIntro: string;
  readonly naverLabel: string;
  readonly naverUrl: string;
  readonly coupangLabel: string;
  readonly coupangUrl: string;
  readonly youtubeLabel: string;
  /** "" hides the YouTube link. */
  readonly youtubeUrl: string;
  /** The card shown while a lookup runs (10월 2일 요청): title, one sentence and the 톡톡 button. */
  readonly loadingTitle: string;
  readonly loadingBody: string;
  readonly loadingButtonLabel: string;
}

export type SiteSettingsField = keyof SiteSettings;

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  storeButtonLabel: STORE_SHEET_OPEN_LABEL,
  storeTitle: resultCopy.showcaseTitle,
  storeIntro: STORE_SHEET_INTRO,
  naverLabel: channels.naver.linkLabel,
  naverUrl: channels.naver.urls.showcase,
  coupangLabel: channels.coupang.linkLabel,
  coupangUrl: channels.coupang.urls.showcase,
  youtubeLabel: channels.youtube.linkLabel,
  youtubeUrl: channels.youtube.url ?? "",
  loadingTitle: "해외 구매, 직접 하기 번거로우셨죠?",
  loadingBody: "구매대행·해외 직구가 필요하면 언제든 편하게 물어보세요.",
  loadingButtonLabel: "톡톡으로 상담하기"
};

const ALLOWED_HOSTS = new Set<string>(channels.allowedHosts);

const label = (max: number) => z.string().trim().min(1, "비어 있어요").max(max, `${max}자 이하로 적어 주세요`);

function isAllowedLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

const LINK_MESSAGE = `https 주소이고 허용된 곳(${channels.allowedHosts.join(", ")})이어야 해요`;
const link = z
  .string()
  .trim()
  .refine(isAllowedLink, LINK_MESSAGE)
  .transform((value) => new URL(value).href);

const FIELD_SCHEMAS = {
  storeButtonLabel: label(30),
  storeTitle: label(30),
  storeIntro: label(120),
  naverLabel: label(30),
  naverUrl: link,
  coupangLabel: label(30),
  coupangUrl: link,
  youtubeLabel: label(30),
  youtubeUrl: z.union([z.literal(""), link]),
  loadingTitle: label(40),
  loadingBody: label(120),
  loadingButtonLabel: label(20)
} satisfies Record<SiteSettingsField, z.ZodType<string>>;

const SiteSettingsSchema = z.object(FIELD_SCHEMAS).strict();

export const SITE_SETTINGS_FIELDS = Object.keys(FIELD_SCHEMAS) as SiteSettingsField[];

export type SiteSettingsValidation =
  | { readonly ok: true; readonly value: SiteSettings }
  | { readonly ok: false; readonly errors: Partial<Record<SiteSettingsField | "form", string>> };

/** A full form from the admin screen: every field must pass. */
export function validateSiteSettings(input: unknown): SiteSettingsValidation {
  const parsed = SiteSettingsSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  const errors: Partial<Record<SiteSettingsField | "form", string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    const key = typeof field === "string" && field in FIELD_SCHEMAS ? (field as SiteSettingsField) : "form";
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}

/** A stored item: each valid field replaces its default; anything else is ignored. */
export function mergeSiteSettings(stored: unknown): SiteSettings {
  if (stored === null || typeof stored !== "object" || Array.isArray(stored)) return DEFAULT_SITE_SETTINGS;
  const record = stored as Record<string, unknown>;
  const merged: Record<SiteSettingsField, string> = { ...DEFAULT_SITE_SETTINGS };
  for (const field of SITE_SETTINGS_FIELDS) {
    const parsed = FIELD_SCHEMAS[field].safeParse(record[field]);
    if (parsed.success) merged[field] = parsed.data;
  }
  return merged;
}

/** Read hosts: Vercel renamed Edge Config to Global Config (GLOBAL_CONFIG, global-config.vercel.com); both still answer. */
const CONFIG_HOSTS = new Set(["global-config.vercel.com", "edge-config.vercel.com"]);

/** The connection string Vercel adds when a store is connected: 'https://global-config.vercel.com/ecfg_…?token=…'. */
export function edgeConfigFromConnection(
  connection: string | undefined
): { readonly id: string; readonly token: string; readonly host: string } | null {
  if (connection === undefined) return null;
  try {
    const url = new URL(connection);
    const id = url.pathname.replace(/^\//, "");
    const token = url.searchParams.get("token");
    if (!CONFIG_HOSTS.has(url.hostname) || !/^ecfg_[A-Za-z0-9]+$/.test(id) || token === null || token === "") return null;
    return { id, token, host: url.hostname };
  } catch {
    return null;
  }
}
