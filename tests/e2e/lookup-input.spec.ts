import { expect, test, type Locator, type Page } from "@playwright/test";
import { channels, lookup, stateGuide } from "@/config/site.config";
import { FAKE, FAKE_GROUPED, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { waitForIdle } from "../support/network-capture";

const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const RESULT_READY = { name: "다시 볼 링크 복사" } as const;

function trackingInput(page: Page): Locator {
  return page.getByRole("textbox", { name: INPUT_LABEL, exact: true });
}

async function recordTrack(page: Page, delayMs = 0): Promise<unknown[]> {
  const bodies: unknown[] = [];
  await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), {
    delayMs,
    onRequest: (body) => bodies.push(body)
  });
  return bodies;
}

test.describe("lookup input (S06)", () => {
  test("the format hint replaces example numbers and describes the input", async ({ page }) => {
    await page.goto("/");
    // Count first: if example buttons came back, the failure prints a count, never a number.
    await expect(page.getByRole("button", { name: /^예시/ })).toHaveCount(0);
    const hint = page.locator("#tracking-format-help");
    await expect(hint).toBeVisible();
    await expect(hint).toHaveText(lookup.copy.formatHint);
    const describedBy = (await trackingInput(page).getAttribute("aria-describedby")) ?? "";
    expect(describedBy.split(" ")).toContain("tracking-format-help");
  });

  test("input attributes suit phone keyboards and nothing takes focus on load", async ({ page }) => {
    await page.goto("/");
    const input = trackingInput(page);
    await expect(input).toHaveAttribute("inputmode", "text");
    await expect(input).toHaveAttribute("autocapitalize", "characters");
    await expect(input).toHaveAttribute("autocomplete", "off");
    await expect(input).toHaveAttribute("enterkeyhint", "search");
    await expect(input).toHaveAttribute("name", "trackingNumber");
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  });

  test("the number is normalized before it is sent", async ({ page }) => {
    const bodies = await recordTrack(page);
    await page.goto("/");
    await trackingInput(page).fill(`  ${FAKE_GROUPED.hbl.toLowerCase().replaceAll(" ", "-")} `);
    await trackingInput(page).press("Enter");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    expect(bodies).toEqual([{ trackingNumber: FAKE.hbl, carrierCode: "AUTO" }]);
  });

  test("the carrier choice lists the five carriers and travels with the request", async ({ page }) => {
    const bodies = await recordTrack(page);
    await page.goto("/");
    const carrier = page.getByRole("combobox", { name: "국내 택배사" });
    await expect(carrier.locator("option")).toHaveText(["자동으로 찾기", "CJ대한통운", "우체국택배", "한진택배", "롯데택배", "로젠택배"]);
    await carrier.selectOption("HANJIN");
    await trackingInput(page).fill(FAKE.domestic);
    await trackingInput(page).press("Enter");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    expect(bodies).toEqual([{ trackingNumber: FAKE.domestic, carrierCode: "HANJIN" }]);
  });

  test("a malformed number is caught before any request, with the reason next to the input", async ({ page }) => {
    const bodies = await recordTrack(page);
    await page.goto("/");
    const input = trackingInput(page);
    await input.fill(FAKE.invalidShort);
    await input.press("Enter");
    const error = page.locator('[data-guide-key="invalidNumber"]');
    await expect(error.getByRole("alert")).toHaveText(stateGuide.invalidNumber.title);
    await expect(error).toContainText("지금 5자리예요");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveValue(FAKE.invalidShort);
    await expect(input).toBeFocused();
    await expect(page.locator('[data-view-state="error"]')).toHaveCount(1);
    await expect(page.locator("details", { hasText: lookup.copy.numberFinderSummary })).toHaveAttribute("open", "");
    const cta = page.locator('[data-cta-state="error"]');
    await expect(cta.getByRole("link").first()).toHaveAccessibleName(`${channels.talk.labels.cta} 새 창으로 열기`);
    await expect(cta.getByRole("link", { name: /스토어/ })).toHaveCount(0);
    await waitForIdle(page);
    expect(bodies).toEqual([]);
  });

  test("correcting the number and submitting again runs the lookup", async ({ page }) => {
    const bodies = await recordTrack(page);
    await page.goto("/");
    const input = trackingInput(page);
    await input.fill(FAKE.invalidShort);
    await input.press("Enter");
    await expect(page.locator('[data-guide-key="invalidNumber"]')).toBeVisible();
    await input.fill(FAKE.domestic);
    await input.press("Enter");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expect(page.locator('[data-guide-key="invalidNumber"]')).toHaveCount(0);
    expect(bodies).toEqual([{ trackingNumber: FAKE.domestic, carrierCode: "AUTO" }]);
  });

  test("while a lookup starts the form stays editable and only the button label changes", async ({ page }) => {
    await page.clock.install();
    const bodies = await recordTrack(page, 2000);
    await page.goto("/");
    await trackingInput(page).fill(FAKE.domestic);
    await page.getByRole("button", { name: lookup.copy.submit }).click();
    await expect(page.getByRole("button", { name: lookup.copy.submitting })).toHaveAttribute("aria-busy", "true");
    await expect(trackingInput(page)).toBeEditable();
    await expect(page.locator('[data-lookup-form="true"]')).toHaveAttribute("aria-busy", "true");
    await expect(page.locator('[data-view-state="loading"]')).toHaveCount(1);
    await page.clock.runFor(500);
    await expect(page.locator('[data-number-bar="true"]')).toBeVisible();
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible({ timeout: 10_000 });
    expect(bodies).toHaveLength(1);
  });
});

test.describe("lookup input without JavaScript (S06)", () => {
  test.use({ javaScriptEnabled: false });

  test("without JavaScript the form reaches the deep-link shell through the redirect", async ({ page }) => {
    await page.goto("/");
    await trackingInput(page).fill(FAKE.domestic);
    await page.getByRole("combobox", { name: "국내 택배사" }).selectOption("CJ");
    await page.getByRole("button", { name: lookup.copy.submit }).click();
    await page.waitForURL((url) => url.pathname === `/${FAKE.domestic}`);
    const bar = page.locator('[data-number-bar="true"]');
    await expect(bar).toContainText(FAKE_GROUPED.domestic);
    await expect(bar).toContainText("CJ대한통운");
  });
});
