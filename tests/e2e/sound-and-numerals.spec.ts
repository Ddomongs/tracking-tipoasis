import { expect, test } from "@playwright/test";
import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";

/** 10월 4일 요청 ③: 효과음은 기본 꺼짐, 헤더 버튼으로 켜고 끄며 이 브라우저에만 기억합니다. */
test("the sound button starts off, appears only after hydration and remembers the choice", async ({ page, request }) => {
  const html = await (await request.get("/")).text();
  expect(html).not.toContain("data-sound-toggle");
  await page.goto("/");
  const button = page.locator("[data-site-header]").getByRole("button", { name: "효과음" });
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => window.localStorage.getItem("tt:sound"))).toBe("on");
  await page.reload();
  await expect(page.locator("[data-site-header]").getByRole("button", { name: "효과음" })).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-site-header]").getByRole("button", { name: "효과음" }).click();
  expect(await page.evaluate(() => window.localStorage.getItem("tt:sound"))).toBeNull();
});

test("a lookup with sound on plays one cue through Web Audio", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("tt:sound", "on");
    const started: number[] = [];
    (window as unknown as { __ttStarted: number[] }).__ttStarted = started;
    const original = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function start(this: OscillatorNode, when?: number) {
      started.push(when ?? 0);
      original.call(this, when);
    };
  });
  await mockTrack(page, trackData("customsWaiting"));
  await page.goto("/");
  // The button (and its listener) loads right after hydration.
  await expect(page.locator("[data-site-header]").getByRole("button", { name: "효과음" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("textbox").first().fill(FAKE.domestic);
  await page.getByRole("button", { name: "조회", exact: false }).first().click();
  await expect(page.locator("[data-result-view]")).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ttStarted: number[] }).__ttStarted.length)).toBeGreaterThan(0);
});

/** 10월 4일 요청 ②: 도착 예상일의 숫자는 큰 세리프(TT Numerals), 월·일은 작은 고딕. */
test("the arrival date digits use the numeral face and are larger than the Korean words", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, trackData("customsWaiting"));
  await page.goto(`/${trackData("customsWaiting").trackingNumber}`);
  const eta = page.locator('[data-slot="eta"]').first();
  await expect(eta).toBeVisible();
  const sizes = await eta.evaluate((slot) => {
    const digit = slot.querySelector("[data-eta-digit]");
    const visual = slot.querySelector("[data-eta-visual]");
    return {
      family: digit ? getComputedStyle(digit).fontFamily : "",
      digit: digit ? Number.parseFloat(getComputedStyle(digit).fontSize) : 0,
      words: visual ? Number.parseFloat(getComputedStyle(visual).fontSize) : 0
    };
  });
  expect(sizes.family).toContain("TT Numerals");
  expect(sizes.digit).toBeGreaterThan(sizes.words * 1.6);
});
