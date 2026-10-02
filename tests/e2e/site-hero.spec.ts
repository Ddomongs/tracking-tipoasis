import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";

/** 10월 2일 요청: 배송 장면이 모든 공개 페이지에서 반복되고, '움직임 멈춤'으로 멈출 수 있습니다(WCAG 2.2.2). */
const ART = path.resolve(__dirname, "..", "..", "public", "art");

test("every public page starts with the scene and its pause switch", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
  for (const route of ["/", `/${FAKE.domestic}`, "/privacy", "/guide", "/guide/faq"]) {
    await page.goto(route);
    const hero = page.locator("[data-site-hero]");
    await expect(hero, route).toHaveCount(1);
    await expect(hero.locator('[data-hero-scene="moving"] img'), route).toBeVisible();
    await expect(hero.locator('[data-hero-scene="still"]'), route).toBeHidden();
    await expect(page.getByRole("checkbox", { name: "움직임 멈춤" }), route).not.toBeChecked();
    expect(await hero.locator("img").first().getAttribute("alt"), route).toBe("");
  }
});

test("the switch swaps in the still picture and back, by mouse and keyboard", async ({ page }) => {
  await page.goto("/guide");
  const hero = page.locator("[data-site-hero]");
  await hero.locator("[data-hero-pause-label]").click();
  await expect(page.getByRole("checkbox", { name: "움직임 멈춤" })).toBeChecked();
  await expect(hero.locator('[data-hero-scene="still"] img')).toBeVisible();
  await expect(hero.locator('[data-hero-scene="moving"]')).toBeHidden();
  await page.getByRole("checkbox", { name: "움직임 멈춤" }).focus();
  await page.keyboard.press("Space");
  await expect(hero.locator('[data-hero-scene="moving"] img')).toBeVisible();
});

test("reduced motion: no switch (the pictures draw their last frame)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("[data-hero-pause-label]")).toBeHidden();
});

test("the scene files: moving ones repeat, still ones and reduced motion never move", () => {
  for (const name of ["hero", "hero-m"]) {
    const moving = readFileSync(path.join(ART, `${name}.svg`), "utf8");
    const still = readFileSync(path.join(ART, `${name}-still.svg`), "utf8");
    expect(moving, name).toContain("animation-iteration-count:infinite");
    expect(moving, name).toContain("@media (prefers-reduced-motion:reduce){*{animation:none!important}}");
    expect(still, name).toMatch(/\n\*\{animation:none!important\}\n/);
    expect(moving.replace(/<style>[\s\S]*<\/style>/, ""), name).toBe(still.replace(/<style>[\s\S]*<\/style>/, ""));
  }
});
