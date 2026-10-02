import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { DEFAULT_SITE_SETTINGS, validateSiteSettings } from "@/lib/site-settings/settings";
import { canSaveSiteSettings, readSiteSettings, saveSiteSettings } from "@/lib/site-settings/store";

/**
 * The CS desk's site-settings endpoint (10월 2일 요청). Behind the /internal basic auth (proxy.ts). GET: the current
 * values, the defaults and whether saving is possible. POST (same origin only): validate the whole form, save it to
 * Edge Config and refresh the public pages so the change shows at once.
 */
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;

export async function GET(): Promise<NextResponse> {
  const { settings, source } = await readSiteSettings({ fresh: true });
  return NextResponse.json(
    { values: settings, defaults: DEFAULT_SITE_SETTINGS, source, writable: canSaveSiteSettings() },
    { headers: { "cache-control": "no-store" } }
  );
}

/** The browser's Origin must name this host (behind Vercel the host arrives as x-forwarded-host). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin === null || host === null) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, reason: "tooLarge" }, { status: 413 });
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, reason: "tooLarge" }, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid", errors: { form: "형식이 올바르지 않아요" } }, { status: 400 });
  }
  const checked = validateSiteSettings(body);
  if (!checked.ok) return NextResponse.json({ ok: false, reason: "invalid", errors: checked.errors }, { status: 400 });
  const saved = await saveSiteSettings(checked.value);
  if (!saved.ok) return NextResponse.json({ ok: false, reason: saved.reason }, { status: saved.reason === "notConfigured" ? 503 : 502 });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, values: checked.value });
}
