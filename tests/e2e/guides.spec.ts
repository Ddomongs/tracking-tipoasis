import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { channels } from "@/config/site.config";
import { GUIDES } from "@/lib/guides/guides";
import { SITE_TITLE } from "@/lib/site";

/** 10월 2일 요청: 검색으로 들어온 사람도 쓸 수 있는 통관 정보 페이지, 대표 이미지와 구조화 데이터. */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function jsonLdTypes(page: Page): Promise<string[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((text) => String((JSON.parse(text) as { "@type"?: unknown })["@type"]));
}

test("the home page carries a guide link and a 1200×630 share image", async ({ page, request }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveTitle(SITE_TITLE);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://tracking.tipoasis.com/og.png");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "통관 가이드", exact: true })).toHaveAttribute("href", "/guide");
  const image = await request.get("/og.png");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
  const bytes = await image.body();
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(630);
});

test("the guide index is indexable and links every guide", async ({ page }) => {
  const response = await page.goto("/guide");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-robots-tag"]).toBeUndefined();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://tracking.tipoasis.com/guide");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("통관 가이드");
  for (const guide of GUIDES) {
    await expect(page.getByRole("link", { name: guide.title, exact: true })).toHaveAttribute("href", `/guide/${guide.slug}`);
  }
  await expect(page.getByRole("link", { name: "지금 조회하기" })).toHaveAttribute("href", "/");
});

for (const guide of GUIDES) {
  test(`${guide.slug}: indexable, titled, with a lookup link, an official source and breadcrumbs`, async ({ page }) => {
    const response = await page.goto(`/guide/${guide.slug}`);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["x-robots-tag"]).toBeUndefined();
    await expect(page).toHaveTitle(`${guide.title} | 통관·배송 조회`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", guide.summary);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://tracking.tipoasis.com/guide/${guide.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(guide.title);
    await expect(page.getByRole("link", { name: "지금 조회하기" })).toHaveAttribute("href", "/");
    const source = page.locator(`a[href="${guide.sources[0]?.url}"]`).first();
    await expect(source).toHaveAttribute("target", "_blank");
    await expect(source).toHaveAttribute("rel", "noopener noreferrer");
    const types = await jsonLdTypes(page);
    expect(types).toContain("BreadcrumbList");
    if (guide.slug === "faq") expect(types).toContain("FAQPage");
    expect(await page.locator(`a[href="${channels.talk.url}"]`).count()).toBeLessThanOrEqual(3);
  });
}

test("FAQ: the visible questions are the JSON-LD questions", async ({ page }) => {
  await page.goto("/guide/faq");
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const faq = blocks.map((text) => JSON.parse(text) as { "@type": string; mainEntity?: { name: string }[] }).find((block) => block["@type"] === "FAQPage");
  const visible = await page.locator("[data-faq-question]").allTextContents();
  expect(visible.length).toBeGreaterThanOrEqual(5);
  expect(faq?.mainEntity?.map((entry) => entry.name)).toEqual(visible.map((text) => text.trim()));
});

test("an unknown guide is a real 404", async ({ page }) => {
  const response = await page.goto("/guide/no-such-guide");
  expect(response?.status()).toBe(404);
});

test("guide pages pass axe WCAG 2.2 AA", async ({ page }) => {
  for (const path of ["/guide", "/guide/customs-steps", "/guide/faq"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations.map((violation) => violation.id), path).toEqual([]);
  }
});
