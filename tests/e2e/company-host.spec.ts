import { expect, test } from "@playwright/test";

const APEX = { host: "tipoasis.com" };

test("tipoasis.com '/' is the company page with the registered business details", async ({ request }) => {
  const response = await request.get("/", { headers: APEX });
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain("또몽이네 스토어");
  expect(html).toContain(["553", "52", "00857"].join("-"));
  expect(html).toContain("제2023-부산해운대-1870호");
  expect(html).toMatch(/<link rel="canonical" href="https:\/\/tipoasis\.com\/?"/);
});

test("old blog paths on tipoasis.com go to '/', and the tracking host keeps its own home", async ({ request }) => {
  const old = await request.get("/2026/07/20/some-old-post", { headers: APEX, maxRedirects: 0 });
  expect(old.status()).toBe(308);
  expect(old.headers()["location"]).toBe("/");

  const www = await request.get("/", { headers: { host: "www.tipoasis.com" } });
  expect(await www.text()).toContain("Business registration");

  for (const host of ["tracking.tipoasis.com", "127.0.0.1"]) {
    const tracking = await request.get("/", { headers: { host } });
    expect(await tracking.text(), host).not.toContain("Business registration");
  }
});
