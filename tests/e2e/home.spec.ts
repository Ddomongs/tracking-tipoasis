import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { channels, disclosures, durations, lookup } from "@/config/site.config";
import { FAKE, FIXTURE_NOW, mockTrack, successBody, trackData } from "../fixtures/tracking-fixtures";

test.describe("site header (S06)", () => {
  test("a 48 px header shows the site name on the left and 문의 on the right, and nothing else", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header).toHaveCount(1);
    expect((await header.boundingBox())?.height).toBe(48);
    await expect(header.getByRole("link")).toHaveCount(2);
    const home = header.getByRole("link", { name: "통관·배송 조회", exact: true });
    const talk = header.getByRole("link", { name: "문의 새 창으로 열기", exact: true });
    await expect(home).toHaveAttribute("href", "/");
    await expect(talk).toHaveAttribute("href", channels.talk.url);
    await expect(talk).toHaveAttribute("target", "_blank");
    await expect(talk).toHaveAttribute("rel", "noopener noreferrer");
    await expect(talk).toHaveAttribute("data-link-placement", "header");
    expect((await home.boundingBox())?.x ?? 0).toBeLessThan((await talk.boundingBox())?.x ?? 0);
  });

  test("the same header sits on the home, a deep link and the privacy page", async ({ page }) => {
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
    for (const path of ["/", `/${FAKE.domestic}`, "/privacy"]) {
      await page.goto(path);
      const header = page.getByRole("banner");
      await expect(header.getByRole("link", { name: "통관·배송 조회", exact: true }), path).toBeVisible();
      await expect(header.getByRole("link", { name: "문의 새 창으로 열기", exact: true }), path).toBeVisible();
    }
  });

  test("the skip link stays off-screen until it is focused", async ({ page }) => {
    await page.goto("/");
    const skip = page.getByRole("link", { name: "본문으로 건너뛰기", exact: true });
    await expect(skip).toHaveAttribute("href", "#main-content");
    expect((await skip.boundingBox())?.y ?? 0).toBeLessThan(0);
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    expect((await skip.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
  });

  test("every public page has exactly one polite live region", async ({ page }) => {
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
    for (const path of ["/", `/${FAKE.domestic}`, "/privacy"]) {
      await page.goto(path);
      await expect(page.locator('[data-live-region="polite"]'), path).toHaveCount(1);
    }
  });
});

const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const HOME_H1 = "통관부터 국내 배송까지 한 번에 확인";
const RESULT_READY = { name: "다시 볼 링크 복사" } as const;

test.describe("home first view (S06)", () => {
  test("one h1 and the lookup form come first; the hero decorations are gone", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(HOME_H1);
    await expect(page.locator('[data-view-state="idle"]')).toHaveCount(1);
    const form = page.locator('[data-lookup-form="true"]');
    await expect(form.getByRole("textbox", { name: INPUT_LABEL, exact: true })).toBeVisible();
    await expect(form.getByRole("combobox", { name: "국내 택배사" })).toBeVisible();
    await expect(form.getByRole("button", { name: "조회하기" })).toBeVisible();
    for (const hook of ["data-logistics-flow", "data-input-shake", "data-motion-cue", "data-tracking-result-summary"]) {
      await expect(page.locator(`[${hook}]`), hook).toHaveCount(0);
    }
    await expect(page.getByRole("region", { name: "배송 조회 안심 안내" })).toHaveCount(0);
    await expect(page.getByText("구매 고객을 위한 배송조회")).toHaveCount(0);
  });

  test("home copy speaks customer language: no AI, robot or brand slogans", async ({ page }) => {
    await page.goto("/");
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\bAI\b|인공지능|로봇|챗봇/);
    await expect(page.getByText("실시간 AI 배송 추적 시스템")).toHaveCount(0);
    await expect(page.locator("body")).toHaveClass(/google-anno-skip/);
  });

  test("the lookup area keeps its ad-exclusion hook and exactly one filled button", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('#tracking[data-ad-exclude="true"]')).toHaveCount(1);
    const filled = page.locator('[data-slot="button"][data-variant="primary"]');
    await expect(filled).toHaveCount(1);
    await expect(filled).toHaveText("조회하기");
  });

  test("no horizontal scroll at 320, 768 and 1280 px", async ({ page }) => {
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}px`).toBe(true);
    }
  });

  test("no infinite animation runs, and reduced motion stops every animation", async ({ page }) => {
    await page.goto("/");
    const infinite = await page.evaluate(
      () => document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations === Number.POSITIVE_INFINITY).length
    );
    expect(infinite).toBe(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    const moving = await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => {
          const duration = Number(animation.effect?.getComputedTiming().duration ?? 0);
          return animation.playState === "running" && duration > 0;
        }).length
    );
    expect(moving).toBe(0);
  });

  test("the skip link moves focus to the main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });
});

test.describe("mode changes stay on '/' (S06)", () => {
  test("[다른 번호 조회] resets to the form without a navigation or a new lookup", async ({ page }) => {
    await page.clock.setFixedTime(FIXTURE_NOW); // the fixture's dates: a plain in-transit result (S07 shows no return link on a stale one)
    const bodies: unknown[] = [];
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.hbl }), { onRequest: (body) => bodies.push(body) });
    const documents: string[] = [];
    page.on("load", () => documents.push(page.url()));
    await page.goto("/");
    const input = page.getByRole("textbox", { name: INPUT_LABEL, exact: true });
    await input.fill(FAKE.hbl);
    await input.press("Enter");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await page.getByRole("button", { name: "다른 번호 조회" }).click();
    await expect(page.locator('[data-view-state="idle"]')).toHaveCount(1);
    await expect(input).toHaveValue(FAKE.hbl);
    await expect(input).toBeFocused();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(HOME_H1);
    expect(new URL(page.url()).pathname).toBe("/");
    expect(documents).toHaveLength(1);
    expect(bodies).toHaveLength(1);
  });

  test("[번호 변경] during a slow lookup returns to the form and ignores the late answer", async ({ page }) => {
    // The answer is held until after the click, so a slow machine cannot let it arrive first (it stays "late").
    let answer: () => void = () => undefined;
    const clicked = new Promise<void>((resolve) => {
      answer = resolve;
    });
    await page.route("**/api/track", async (route) => {
      await clicked;
      await route.fulfill({ contentType: "application/json", body: successBody(trackData("inTransit", { trackingNumber: FAKE.domestic })) }).catch(() => undefined);
    });
    await page.goto("/");
    const input = page.getByRole("textbox", { name: INPUT_LABEL, exact: true });
    await input.fill(FAKE.domestic);
    await input.press("Enter");
    await expect(page.locator('[data-number-bar="true"]')).toBeVisible();
    await page.getByRole("button", { name: "번호 변경" }).click();
    answer();
    await expect(input).toHaveValue(FAKE.domestic);
    await expect(input).toBeFocused();
    await page.waitForTimeout(1500);
    await expect(page.getByRole("button", RESULT_READY)).toHaveCount(0);
    await expect(page.locator('[data-view-state="idle"]')).toHaveCount(1);
  });
});

/** Outside every shipped notice window, so no banner changes the first-view geometry (spec §16 item 1 relaxes it on notice days). */
const NO_NOTICE_TIME = new Date("2026-11-18T10:00:00+09:00");
const SHORTCUT_REGION = { name: "상담·스토어 바로가기" } as const;

test.describe("상담·스토어 바로가기 row (S06, approval 1)", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NO_NOTICE_TIME);
  });

  test("the row is in the first view at 390×844, 375×812 and 360×780 and nothing covers the lookup button or the row", async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 375, height: 812 },
      { width: 360, height: 780 }
    ]) {
      const size = `${viewport.width}×${viewport.height}`;
      await page.setViewportSize(viewport);
      await page.goto("/");
      const row = page.getByRole("region", SHORTCUT_REGION);
      await expect(row, size).toHaveAttribute("data-shortcut-row", "full");
      await expect(row, size).toBeInViewport({ ratio: 1 });
      await page.getByRole("button", { name: "조회하기" }).click({ trial: true });
      for (const name of ["톡톡 상담", "네이버 스토어", "쿠팡 스토어"]) {
        await row.getByRole("link", { name: `${name} 새 창으로 열기` }).click({ trial: true });
      }
    }
  });

  test("the row ends by 550 px at 375×667 (about 500 px at 375×812)", async ({ page }) => {
    for (const viewport of [
      { width: 375, height: 667 },
      { width: 375, height: 812 }
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      // The server paints the notice by its own clock; the client drops it after mount (NO_NOTICE_TIME). Measure after that.
      await expect(page.locator("aside[data-notice-variant=\"banner\"]")).toHaveCount(0);
      const box = await page.getByRole("region", SHORTCUT_REGION).boundingBox();
      const bottom = Math.round((box?.y ?? 0) + (box?.height ?? Number.POSITIVE_INFINITY));
      console.info(`[geometry] shortcut row bottom at ${viewport.width}x${viewport.height}: ${bottom} px (max 550 px)`);
      expect(bottom).toBeLessThanOrEqual(550);
    }
  });

  test("the definitive disclosure comes before the coupang link, and only affiliate links are sponsored", async ({ page }) => {
    await page.goto("/");
    const row = page.getByRole("region", SHORTCUT_REGION);
    await expect(row.locator("p, a").first()).toHaveAttribute("data-affiliate-disclosure", "coupang");
    await expect(row.locator('[data-affiliate-disclosure="coupang"]')).toHaveText(disclosures.coupang);
    const relFor = (isAffiliate: boolean): string => (isAffiliate ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer");
    const links = [
      { name: "톡톡 상담", href: channels.talk.url, rel: relFor(false) },
      { name: "네이버 스토어", href: channels.naver.urls.shortcut, rel: relFor(channels.naver.isAffiliate) },
      { name: "쿠팡 스토어", href: channels.coupang.urls.shortcut, rel: relFor(channels.coupang.isAffiliate) }
    ];
    for (const link of links) {
      const anchor = row.getByRole("link", { name: `${link.name} 새 창으로 열기` });
      await expect(anchor, link.name).toHaveAttribute("href", link.href);
      await expect(anchor, link.name).toHaveAttribute("rel", link.rel);
      await expect(anchor, link.name).toHaveAttribute("target", "_blank");
      await expect(anchor, link.name).toHaveAttribute("data-link-placement", "shortcut");
      expect((await anchor.boundingBox())?.height ?? 0, link.name).toBeGreaterThanOrEqual(44);
    }
  });

  test("only 톡톡 stays while the number is invalid; the row is gone in loading and results", async ({ page }) => {
    await page.clock.setFixedTime(FIXTURE_NOW); // the fixture's dates: a plain in-transit result (S07 shows no return link on a stale one)
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 1500 });
    await page.goto("/");
    const input = page.getByRole("textbox", { name: INPUT_LABEL, exact: true });
    await input.fill(FAKE.invalidShort);
    await input.press("Enter");
    const row = page.getByRole("region", SHORTCUT_REGION);
    await expect(row).toHaveAttribute("data-shortcut-row", "talkOnly");
    await expect(row.getByRole("link")).toHaveCount(1);
    await expect(row.getByRole("link").first()).toHaveAccessibleName(`${channels.talk.labels.cta} 새 창으로 열기`);
    await expect(row.locator("[data-affiliate-disclosure]")).toHaveCount(0);
    await input.fill(FAKE.domestic);
    await input.press("Enter");
    await expect(page.locator('[data-number-bar="true"]')).toBeVisible();
    await expect(page.locator("[data-shortcut-row]")).toHaveCount(0);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await expect(page.locator("[data-shortcut-row]")).toHaveCount(0);
  });

  test("no dialog opens by itself", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1500);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("below the form (S06)", () => {
  test("'보통 이렇게 걸려요' opens the four typical durations from config", async ({ page }) => {
    await page.goto("/");
    const summary = page.getByText(lookup.copy.typicalSummary, { exact: true });
    const details = page.locator("details", { has: summary });
    await expect(details).not.toHaveAttribute("open");
    await summary.click();
    await expect(details).toHaveAttribute("open", "");
    await expect(details.locator("dt")).toHaveText(["해외 출발", "입항·통관", "국내 배송", "도착"]);
    await expect(details.locator("dd")).toHaveText(durations.typical.map((row) => row.text));
  });

  test("a notice that has ended by the customer's clock is gone after mount", async ({ page }) => {
    await page.clock.setFixedTime(NO_NOTICE_TIME);
    await page.goto("/");
    await expect(page.locator('[data-view-state="idle"]')).toHaveCount(1);
    await expect(page.locator("[data-notice-kind]")).toHaveCount(0);
  });
});

test.describe("style tokens on the page (S06)", () => {
  test("the page ground and text colors come from the style tokens", async ({ page }) => {
    await page.goto("/");
    const colors = await page.evaluate(() => {
      const probe = (value: string): string => {
        const element = document.createElement("span");
        element.style.color = value;
        document.body.append(element);
        const rgb = getComputedStyle(element).color;
        element.remove();
        return rgb;
      };
      const root = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      return {
        ground: probe(root.getPropertyValue("--tt-ground").trim()),
        ink: probe(root.getPropertyValue("--tt-ink").trim()),
        background: body.backgroundColor,
        color: body.color
      };
    });
    expect(colors.background).toBe(colors.ground);
    expect(colors.color).toBe(colors.ink);
  });

  test("a settled result runs no infinite animation", async ({ page }) => {
    await page.clock.setFixedTime(FIXTURE_NOW); // the fixture's dates: a plain in-transit result (S07 shows no return link on a stale one)
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.hbl }));
    await page.goto(`/${FAKE.hbl}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    const infinite = await page.evaluate(
      () => document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations === Number.POSITIVE_INFINITY).length
    );
    expect(infinite).toBe(0);
  });
});

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("axe (S06, approval 13)", () => {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1280, height: 900 }
  ]) {
    test(`home, INVALID and a loading deep link have no WCAG 2.2 AA violations at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 20_000 });
      const scan = async (label: string): Promise<void> => {
        const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        expect(results.violations.map((violation) => `${violation.id} (${violation.nodes.length})`), label).toEqual([]);
      };
      await page.goto("/");
      await scan("home");
      await page.goto(`/${FAKE.deepLinkInvalid}`);
      await scan("INVALID deep link");
      await page.goto(`/${FAKE.domestic}`);
      await expect(page.locator('[data-number-bar="true"]')).toBeVisible();
      await scan("deep link while loading");
    });
  }
});

test.describe("history and the header after a lookup (S06 review)", () => {
  test("Back then Forward to a failed lookup: [다시 조회] looks the number up again", async ({ page }) => {
    const numbers: unknown[] = [];
    await mockTrack(page, "serverError500", { onRequest: (body) => numbers.push(body) });
    await page.goto("/");
    const lengthBefore = await page.evaluate(() => history.length);
    await page.getByRole("textbox", { name: INPUT_LABEL, exact: true }).fill(FAKE.domestic);
    await page.getByRole("textbox", { name: INPUT_LABEL, exact: true }).press("Enter");
    const retry = page.getByRole("button", { name: "다시 조회", exact: true });
    await expect(retry).toBeVisible();
    // The same-address entry is pushed right after the screen is presented; Back before it would leave the site.
    await expect.poll(() => page.evaluate(() => history.length)).toBe(lengthBefore + 1);
    await page.goBack();
    await expect(page.getByRole("textbox", { name: INPUT_LABEL, exact: true })).toBeVisible();
    await page.goForward();
    await expect(retry).toBeVisible();
    await retry.click();
    await expect.poll(() => numbers.length).toBe(2);
  });

  test("the site name in the header brings a home result back to the lookup form", async ({ page }) => {
    await page.clock.setFixedTime(FIXTURE_NOW); // the fixture's dates: a plain in-transit result (S07 shows no return link on a stale one)
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }));
    await page.goto("/");
    await page.getByRole("textbox", { name: INPUT_LABEL, exact: true }).fill(FAKE.domestic);
    await page.getByRole("textbox", { name: INPUT_LABEL, exact: true }).press("Enter");
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await page.getByRole("banner").getByRole("link", { name: "통관·배송 조회", exact: true }).click();
    await expect(page.getByRole("textbox", { name: INPUT_LABEL, exact: true })).toBeVisible();
    await expect(page.getByRole("button", RESULT_READY)).toHaveCount(0);
  });
});
