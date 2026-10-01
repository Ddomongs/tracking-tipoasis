import { expect, type Page } from "@playwright/test";
import { INTERNAL_TAB_LABELS, type InternalTabId } from "@/components/internal/tabs";

/** Opens /internal/cs-helper on one tab; the calling spec uses INTERNAL_TEST_CREDENTIALS. */
export async function openDesk(page: Page, tab: InternalTabId): Promise<void> {
  await page.goto(`/internal/cs-helper?tab=${tab}`);
  await expect(page.getByRole("tab", { name: INTERNAL_TAB_LABELS[tab], exact: true })).toHaveAttribute("aria-selected", "true");
}
