import { expect, test, type Locator, type Page } from "@playwright/test";
import { INTERNAL_TAB_IDS, INTERNAL_TAB_LABELS, type InternalTabId } from "@/components/internal/tabs";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import { openDesk } from "../support/internal-desk";

test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

const tab = (page: Page, id: InternalTabId): Locator => page.getByRole("tab", { name: INTERNAL_TAB_LABELS[id], exact: true });
const panel = (page: Page, id: InternalTabId): Locator => page.locator(`[data-internal-tab="${id}"]`);

async function expectSelected(page: Page, selected: InternalTabId): Promise<void> {
  for (const id of INTERNAL_TAB_IDS) {
    const isSelected = id === selected;
    await expect(tab(page, id)).toHaveAttribute("aria-selected", String(isSelected));
    await expect(tab(page, id)).toHaveAttribute("tabindex", isSelected ? "0" : "-1");
    if (isSelected) await expect(panel(page, id)).toBeVisible();
    else await expect(panel(page, id)).toBeHidden();
  }
}

test("one tablist names every tab, and each tab controls its labelled panel", async ({ page }) => {
  await page.goto("/internal/cs-helper");
  await expect(page.getByRole("heading", { level: 1, name: "배송·통관 CS 데스크" })).toBeVisible();
  const list = page.getByRole("tablist", { name: "CS 데스크 메뉴" });
  await expect(list.getByRole("tab")).toHaveText(INTERNAL_TAB_IDS.map((id) => INTERNAL_TAB_LABELS[id]));
  for (const id of INTERNAL_TAB_IDS) {
    const controls = await tab(page, id).getAttribute("aria-controls");
    const ownId = await tab(page, id).getAttribute("id");
    expect(controls).not.toBeNull();
    const target = page.locator(`[id="${controls ?? ""}"]`);
    await expect(target).toHaveAttribute("role", "tabpanel");
    await expect(target).toHaveAttribute("data-internal-tab", id);
    await expect(target).toHaveAttribute("aria-labelledby", ownId ?? "");
  }
  await expectSelected(page, "delivery");
});

test("clicking a tab selects it and shows only its panel", async ({ page }) => {
  await page.goto("/internal/cs-helper");
  for (const id of [...INTERNAL_TAB_IDS].reverse()) {
    await tab(page, id).click();
    await expectSelected(page, id);
  }
});

test("arrow keys, Home and End move the selection and the focus", async ({ page }) => {
  const first = INTERNAL_TAB_IDS[0];
  const second = INTERNAL_TAB_IDS[1];
  const last = INTERNAL_TAB_IDS[INTERNAL_TAB_IDS.length - 1];
  await page.goto("/internal/cs-helper");
  await tab(page, first).focus();
  await page.keyboard.press("ArrowRight");
  await expectSelected(page, second);
  await expect(tab(page, second)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expectSelected(page, first);
  await page.keyboard.press("ArrowLeft");
  await expectSelected(page, last);
  await expect(tab(page, last)).toBeFocused();
  await page.keyboard.press("Home");
  await expectSelected(page, first);
  await page.keyboard.press("End");
  await expectSelected(page, last);
});

test("?tab= opens that tab; anything else opens 배송 안내", async ({ page }) => {
  for (const id of INTERNAL_TAB_IDS) {
    await openDesk(page, id);
    await expectSelected(page, id);
  }
  await page.goto("/internal/cs-helper?tab=unknown");
  await expectSelected(page, "delivery");
});

test("a panel keeps what staff typed while another tab is shown", async ({ page }) => {
  await openDesk(page, "mismatch");
  await page.getByLabel("운송장/주문 메모", { exact: true }).fill("ORDER-KEEP");
  await tab(page, "delivery").click();
  await tab(page, "mismatch").click();
  await expect(page.getByLabel("운송장/주문 메모", { exact: true })).toHaveValue("ORDER-KEEP");
});

test("the desk has the four tabs of spec §10 and the site-settings tab (10월 2일), in order", () => {
  expect(INTERNAL_TAB_IDS).toEqual(["delivery", "mismatch", "preview", "notices", "site"]);
  expect(INTERNAL_TAB_IDS.map((id) => INTERNAL_TAB_LABELS[id])).toEqual(["배송 안내", "통관부호 불일치", "안내표 미리보기", "공지 현황", "사이트 문구·링크"]);
});
