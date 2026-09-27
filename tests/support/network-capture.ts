import { expect } from "@playwright/test";
import type { Page, Request, Route } from "@playwright/test";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";

export interface CapturedRequest {
  readonly url: string;
  readonly method: string;
  readonly postData: string | null;
  readonly referer: string | null;
  readonly locationAtRequest: string | null;
}

/** Must equal the host of `use.baseURL` in playwright.config.ts. */
const APP_HOST = "127.0.0.1:43210";
const RECORDED_FIRST_PARTY = /^\/(?:_vercel\/insights\/|_vercel\/speed-insights\/|api\/csp-report(?:\/|$))/;

function isRecorded(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return url.host !== APP_HOST || RECORDED_FIRST_PARTY.test(url.pathname);
}

function frameUrlOf(request: Request): string | null {
  try {
    return request.frame().url();
  } catch {
    return null;
  }
}

/** Routes every request whose origin differs from the app: records it, then aborts it. First-party
 *  /_vercel/insights/*, /_vercel/speed-insights/* and /api/csp-report are recorded and continued. */
export async function captureThirdParty(page: Page): Promise<{ readonly requests: () => readonly CapturedRequest[] }> {
  const captured: CapturedRequest[] = [];
  await page.route(isRecorded, async (route: Route) => {
    const request = route.request();
    const locationAtRequest = frameUrlOf(request);
    const referer = await request.headerValue("referer");
    captured.push({ url: request.url(), method: request.method(), postData: request.postData(), referer, locationAtRequest });
    if (new URL(request.url()).host === APP_HOST) {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
  return { requests: () => [...captured] };
}

function isTrackApiPost(request: CapturedRequest): boolean {
  const url = new URL(request.url);
  return request.method === "POST" && url.host === APP_HOST && url.pathname === "/api/track";
}

/** 0 tracking-like values in URL, referer, page location at request time and body; the /api/track POST body is exempt. */
export function assertNoTrackingValues(requests: readonly CapturedRequest[]): void {
  for (const request of requests) {
    const fields: ReadonlyArray<readonly [string, string | null]> = [
      ["url", request.url],
      ["referer", request.referer],
      ["page location at request time", request.locationAtRequest],
      ["body", isTrackApiPost(request) ? null : request.postData]
    ];
    for (const [field, value] of fields) {
      if (value === null) continue;
      expect(containsTrackingLikeValue(value), `${field} of ${request.method} ${request.url} carries a tracking-like value`).toBe(false);
    }
  }
}

export interface WatchedDocument {
  readonly documentId: string;
  readonly startHref: string;
}

export interface AdLoaderInsertion {
  readonly documentId: string;
  readonly pathname: string;
  readonly href: string;
  readonly hasPageUrlAttribute: boolean;
}

export interface AdLoaderWatch {
  readonly documents: () => readonly WatchedDocument[];
  readonly insertions: () => readonly AdLoaderInsertion[];
  readonly currentDocumentId: () => Promise<string>;
}

type WatchEvent =
  | { readonly kind: "document"; readonly document: WatchedDocument }
  | { readonly kind: "insertion"; readonly insertion: AdLoaderInsertion };

function parseWatchEvent(value: unknown): WatchEvent | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("kind" in value) || !("documentId" in value) || !("href" in value)) return null;
  const { kind, documentId, href } = value;
  if (typeof documentId !== "string" || typeof href !== "string") return null;
  if (kind === "document") return { kind, document: { documentId, startHref: href } };
  if (
    kind === "insertion" &&
    "pathname" in value &&
    "hasPageUrlAttribute" in value &&
    typeof value.pathname === "string" &&
    typeof value.hasPageUrlAttribute === "boolean"
  ) {
    return {
      kind,
      insertion: { documentId, href, pathname: value.pathname, hasPageUrlAttribute: value.hasPageUrlAttribute }
    };
  }
  return null;
}

/** Records every top-level document and every `script[data-ad-loader="adsense"]` insertion with the URL at that moment. */
export async function watchAdLoader(page: Page): Promise<AdLoaderWatch> {
  const documents: WatchedDocument[] = [];
  const insertions: AdLoaderInsertion[] = [];
  await page.exposeBinding("__ttAdLoaderEvent", (_source, payload: unknown) => {
    const event = parseWatchEvent(payload);
    if (event?.kind === "document") documents.push(event.document);
    if (event?.kind === "insertion") insertions.push(event.insertion);
  });
  await page.addInitScript(() => {
    if (window.top !== window) return;
    const documentId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    Object.defineProperty(window, "__ttDocumentId", { value: documentId });
    const send = (payload: object): void => {
      const binding: unknown = Reflect.get(window, "__ttAdLoaderEvent");
      if (typeof binding === "function") void binding(payload);
    };
    send({ kind: "document", documentId, href: location.href });
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLScriptElement && node.dataset.adLoader === "adsense") {
            send({
              kind: "insertion",
              documentId,
              href: location.href,
              pathname: location.pathname,
              hasPageUrlAttribute: node.hasAttribute("data-page-url")
            });
          }
        });
      }
    }).observe(document, { childList: true, subtree: true });
  });
  return {
    documents: () => [...documents],
    insertions: () => [...insertions],
    currentDocumentId: () => page.evaluate(() => String(Reflect.get(window, "__ttDocumentId")))
  };
}

export interface LookupRecorder {
  readonly numbers: () => readonly string[];
  readonly carriers: () => readonly string[];
  readonly onRequest: (body: unknown) => void;
}

/** Pass `onRequest` to `mockTrack(page, response, { onRequest })` to record every /api/track body. */
export function recordLookups(): LookupRecorder {
  const numbers: string[] = [];
  const carriers: string[] = [];
  return {
    numbers: () => [...numbers],
    carriers: () => [...carriers],
    onRequest: (body: unknown) => {
      if (typeof body !== "object" || body === null) return;
      if ("trackingNumber" in body && typeof body.trackingNumber === "string") numbers.push(body.trackingNumber);
      if ("carrierCode" in body && typeof body.carrierCode === "string") carriers.push(body.carrierCode);
    }
  };
}

/** Waits for `load` plus two idle callbacks: hydration effects, restore and a scheduled loader insertion have run. */
export async function waitForIdle(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const idle = (next: () => void): void => {
          if (typeof requestIdleCallback === "function") requestIdleCallback(() => next(), { timeout: 2500 });
          else setTimeout(next, 50);
        };
        idle(() => idle(resolve));
      })
  );
}
