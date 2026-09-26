import { expect, test } from "@playwright/test";
import { FAKE } from "../fixtures/tracking-fixtures";

test("robots.txt is a real text route that allows the site and points to the sitemap", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");
  const lines = (await response.text()).split("\n").map((line) => line.trim());
  expect(lines).toContain("User-Agent: *");
  expect(lines).toContain("Allow: /");
  expect(lines).toContain("Disallow: /api/");
  expect(lines).toContain("Disallow: /internal/");
  expect(lines).toContain("Sitemap: https://tracking.tipoasis.com/sitemap.xml");
});

test("sitemap.xml lists the two public pages and no number route", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("xml");
  const body = await response.text();
  const locations = Array.from(body.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]);
  expect(locations).toEqual(["https://tracking.tipoasis.com/", "https://tracking.tipoasis.com/privacy"]);
  expect(body).not.toContain(FAKE.domestic);
});

test("an unknown multi-segment path is a real 404 with a way back to the lookup", async ({ page }) => {
  const response = await page.goto("/no/such/page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "페이지를 찾을 수 없어요" })).toBeVisible();
  await expect(page.getByRole("link", { name: "배송 조회로 돌아가기" })).toHaveAttribute("href", "/");
});
