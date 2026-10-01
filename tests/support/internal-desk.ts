import { expect, type Page } from "@playwright/test";
import { INTERNAL_TAB_LABELS, type InternalTabId } from "@/components/internal/tabs";

declare global {
  interface Window {
    __ttCopied?: string[];
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
