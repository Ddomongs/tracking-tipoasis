import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { FAKE, FIXTURE_NOW, mockTrack, trackData } from "../fixtures/tracking-fixtures";
import { IS_PRODUCTION_RUN } from "../support/prod-mode";

// The fixtures' dates: on a later real day these results turn overdue and the return link is withheld, so pin the clock.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXTURE_NOW);
});

const REPO_ROOT = path.resolve(__dirname, "..", "..");
/** Spec §12 2.2.2: after 8 s nothing may still be moving forever. */
const SETTLE_MS = 8500;
const RESULT_READY = { name: "다시 볼 링크 복사" } as const;

async function infiniteAnimations(page: Page): Promise<readonly string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.playState === "running" && animation.effect?.getTiming().iterations === Number.POSITIVE_INFINITY)
      .map((animation) => {
        const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
        const name = animation instanceof CSSAnimation ? animation.animationName : "script";
        return `${name} on ${target?.tagName ?? "?"}`;
      })
  );
}

async function movingAnimations(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.getAnimations().filter((animation) => {
        const duration = Number(animation.effect?.getComputedTiming().duration ?? 0);
        return animation.playState === "running" && duration > 0;
      }).length
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [full] : [];
  });
}

test.describe("motion budget (S06)", () => {
  test.skip(!IS_PRODUCTION_RUN, "budgets run against next start");
  test.describe.configure({ timeout: 90_000 });

  test("no infinite animation 8 s after load: home, a loading deep link and a settled result", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(SETTLE_MS);
    expect(await infiniteAnimations(page), "home").toEqual([]);

    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.domestic }), { delayMs: 30_000 });
    await page.goto(`/${FAKE.domestic}`);
    await page.waitForTimeout(SETTLE_MS);
    expect(await infiniteAnimations(page), "loading deep link").toEqual([]);

    await page.unroute("**/api/track");
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.hbl }));
    await page.goto(`/${FAKE.hbl}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);
    expect(await infiniteAnimations(page), "settled result").toEqual([]);
  });

  test("reduced motion: nothing animates on home and on a settled result", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForTimeout(500);
    expect(await movingAnimations(page), "home").toBe(0);
    await mockTrack(page, trackData("inTransit", { trackingNumber: FAKE.hbl }));
    await page.goto(`/${FAKE.hbl}`);
    await expect(page.getByRole("button", RESULT_READY)).toBeVisible();
    await page.waitForTimeout(500);
    expect(await movingAnimations(page), "settled result").toBe(0);
  });

  test("framer-motion is uninstalled and imported nowhere", () => {
    const manifest = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as {
      readonly dependencies?: Readonly<Record<string, string>>;
      readonly devDependencies?: Readonly<Record<string, string>>;
    };
    expect(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })).not.toContain("framer-motion");
    const importers = ["app", "components", "lib"]
      .flatMap((dir) => sourceFiles(path.join(REPO_ROOT, dir)))
      .filter((file) => readFileSync(file, "utf8").includes("framer-motion"))
      .map((file) => path.relative(REPO_ROOT, file));
    expect(importers).toEqual([]);
  });
});
