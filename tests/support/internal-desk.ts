import { expect, type Page } from "@playwright/test";
import { INTERNAL_TAB_LABELS, type InternalTabId } from "@/components/internal/tabs";

declare global {
  interface Window {
    __ttCopied?: string[];
    __ttTrackStarts?: number[];
  }
}

/** Opens /internal/cs-helper on one tab; the calling spec uses INTERNAL_TEST_CREDENTIALS. */
export async function openDesk(page: Page, tab: InternalTabId): Promise<void> {
  await page.goto(`/internal/cs-helper?tab=${tab}`);
  await expect(page.getByRole("tab", { name: INTERNAL_TAB_LABELS[tab], exact: true })).toHaveAttribute("aria-selected", "true");
}

/** Replaces navigator.clipboard.writeText with a recorder, so a test reads exactly what a copy button copied. */
export async function recordClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const copied: string[] = [];
    window.__ttCopied = copied;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string): Promise<void> => {
          copied.push(text);
          return Promise.resolve();
        }
      }
    });
  });
}

export async function copiedTexts(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => window.__ttCopied ?? []);
}

/** A clipboard that refuses every write (the API rejects, execCommand('copy') fails), like a locked-down browser. */
export async function blockClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (): Promise<void> => Promise.reject(new DOMException("blocked", "NotAllowedError")) }
    });
    document.execCommand = (): boolean => false;
  });
}

/** Records performance.now() whenever the page starts a request to /api/track. */
export async function recordTrackStarts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const starts: number[] = [];
    window.__ttTrackStarts = starts;
    const original = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/track")) starts.push(performance.now());
      return original(input, init);
    };
  });
}

export async function trackStarts(page: Page): Promise<readonly number[]> {
  return page.evaluate(() => window.__ttTrackStarts ?? []);
}
