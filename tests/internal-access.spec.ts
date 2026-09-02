import { expect, test } from "@playwright/test";
import { INTERNAL_TEST_CREDENTIALS } from "./internal-auth";

test.describe("internal page access control", () => {
  test("rejects internal pages without credentials", async ({ request }) => {
    const response = await request.get("/internal/cs-helper");

    expect(response.status()).toBe(401);
    expect(response.headers()["www-authenticate"]).toContain("Basic");
  });

  test("keeps the public tracking page open without credentials", async ({ request }) => {
    const response = await request.get("/");

    expect(response.status()).toBe(200);
  });

  test.describe("with a wrong password", () => {
    test.use({ httpCredentials: { username: "cs", password: "wrong-password" } });

    test("rejects internal pages", async ({ request }) => {
      const response = await request.get("/internal/cs-helper");

      expect(response.status()).toBe(401);
    });
  });

  test.describe("with the configured password", () => {
    test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

    test("allows internal pages", async ({ request }) => {
      const response = await request.get("/internal/cs-helper");

      expect(response.status()).toBe(200);
    });
  });
});
