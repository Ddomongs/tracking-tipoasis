import { expect, test } from "@playwright/test";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings/settings";
import { INTERNAL_TEST_CREDENTIALS } from "../internal-auth";
import { openDesk } from "../support/internal-desk";

/** 10월 2일 요청: 관리자 화면 '사이트 문구·링크'에서 첫 화면 스토어 칸의 문구와 링크를 바꿉니다(저장소: Vercel Edge Config). */
test.use({ httpCredentials: INTERNAL_TEST_CREDENTIALS });

const AUTH = `Basic ${Buffer.from(`${INTERNAL_TEST_CREDENTIALS.username}:${INTERNAL_TEST_CREDENTIALS.password}`).toString("base64")}`;

test("the tab shows the current values; without a store it says so and a save explains why it cannot", async ({ page }) => {
  await openDesk(page, "site");
  const panel = page.locator("[data-site-settings]");
  await expect(panel.getByRole("heading", { level: 2, name: "사이트 문구·링크" })).toBeVisible();
  await expect(panel.getByRole("textbox", { name: "여는 버튼 문구" })).toHaveValue(DEFAULT_SITE_SETTINGS.storeButtonLabel);
  await expect(panel.getByRole("group", { name: "네이버 스토어" }).getByRole("textbox", { name: "링크 주소" })).toHaveValue(
    DEFAULT_SITE_SETTINGS.naverUrl
  );
  await expect(panel.locator("[data-site-settings-readonly]")).toBeVisible();
  await panel.getByRole("button", { name: "저장" }).click();
  await expect(panel.getByRole("status")).toHaveText("저장소(Global Config)나 저장용 토큰이 아직 없어 저장할 수 없어요.");
});

test("invalid values are checked before saving and point at the field", async ({ page }) => {
  await openDesk(page, "site");
  const panel = page.locator("[data-site-settings]");
  const naverUrl = panel.getByRole("group", { name: "네이버 스토어" }).getByRole("textbox", { name: "링크 주소" });
  await naverUrl.fill("https://evil.example.com/");
  await panel.getByRole("textbox", { name: "칸 제목" }).fill(" ");
  await panel.getByRole("button", { name: "저장" }).click();
  await expect(panel.getByRole("status")).toHaveText("고칠 칸이 있어요. 빨간 안내를 확인해 주세요.");
  await expect(naverUrl).toHaveAttribute("aria-invalid", "true");
  await expect(panel.getByRole("textbox", { name: "칸 제목" })).toHaveAttribute("aria-invalid", "true");
  await panel.getByRole("button", { name: "기본값 불러오기" }).click();
  await expect(naverUrl).toHaveValue(DEFAULT_SITE_SETTINGS.naverUrl);
});

test("the endpoint needs the internal password and refuses a cross-site save", async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL, httpCredentials: { username: "cs", password: "wrong-password" } });
  expect((await anonymous.get("/internal/site-settings")).status()).toBe(401);
  const staff = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { authorization: AUTH } });
  const current = await staff.get("/internal/site-settings");
  expect(current.status()).toBe(200);
  expect(await current.json()).toMatchObject({ values: DEFAULT_SITE_SETTINGS, defaults: DEFAULT_SITE_SETTINGS, writable: false });
  const crossSite = await staff.post("/internal/site-settings", { data: DEFAULT_SITE_SETTINGS, headers: { origin: "https://evil.example.com" } });
  expect(crossSite.status()).toBe(403);
  const noOrigin = await staff.post("/internal/site-settings", { data: DEFAULT_SITE_SETTINGS });
  expect(noOrigin.status()).toBe(403);
  const sameSite = { origin: new URL(baseURL ?? "http://127.0.0.1").origin };
  const tooLarge = await staff.post("/internal/site-settings", { data: { storeTitle: "가".repeat(9000) }, headers: sameSite });
  expect(tooLarge.status()).toBe(413);
  const unknownField = await staff.post("/internal/site-settings", { data: { ...DEFAULT_SITE_SETTINGS, extra: "x" }, headers: sameSite });
  expect(unknownField.status()).toBe(400);
  await anonymous.dispose();
  await staff.dispose();
});
