import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";

/**
 * 10월 2일 요청: 헤더와 배송 장면이 한 덩어리 파란 띠이고, 장면은 모든 공개 페이지에서 한 번(약 4초) 재생하고 멈춥니다.
 * '움직임 멈춤' 버튼은 없앴고, 그래서 그림 안 애니메이션은 5초 안에 끝나야 합니다(WCAG 2.2.2).
 */
const ART = path.resolve(__dirname, "..", "..", "public", "art");

test("every public page starts with the header band and the scene; no pause control", async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
  await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
  for (const route of ["/", `/${FAKE.domestic}`, "/privacy", "/guide", "/guide/faq"]) {
    await page.goto(route);
    const hero = page.locator("[data-site-hero]");
    await expect(hero, route).toHaveCount(1);
    await expect(hero.locator("img"), route).toBeVisible();
    expect(await hero.locator("img").getAttribute("alt"), route).toBe("");
    await expect(page.getByRole("checkbox", { name: "움직임 멈춤" }), route).toHaveCount(0);
  }
});

test("header and scene share one band colour, and the header text is white", async ({ page }) => {
  await page.goto("/");
  const colours = await page.evaluate(() => {
    const header = document.querySelector("[data-site-header]");
    const hero = document.querySelector("[data-site-hero]");
    return {
      header: header === null ? "" : getComputedStyle(header).backgroundColor,
      hero: hero === null ? "" : getComputedStyle(hero).backgroundColor,
      text: header === null ? "" : getComputedStyle(header).color
    };
  });
  expect(colours.header).toBe("rgb(35, 64, 208)");
  expect(colours.hero).toBe(colours.header);
  expect(colours.text).toBe("rgb(255, 255, 255)");
});

test("the scene files play once and stop within 5 s; reduced motion never moves", () => {
  for (const name of ["hero", "hero-m"]) {
    const svg = readFileSync(path.join(ART, `${name}.svg`), "utf8");
    expect(svg, name).not.toContain("infinite");
    expect(svg, name).toContain("animation-iteration-count:1");
    expect(svg, name).toContain("@media (prefers-reduced-motion:reduce){*{animation:none!important}}");
    // 7 s cycles whose keyframes all settle by 55 % (3.85 s).
    const settles = Array.from(svg.matchAll(/(\d+(?:\.\d+)?)%,100%/g), (match) => Number(match[1]));
    expect(settles.length, name).toBeGreaterThan(0);
    expect(Math.max(...settles), name).toBeLessThanOrEqual(55);
  }
});
