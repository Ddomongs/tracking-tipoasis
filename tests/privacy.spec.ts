import { expect, test } from "@playwright/test";
import { AD_TIMING_POLICY } from "@/lib/ads/ad-gate";
import type { AdTimingPolicy } from "@/lib/ads/ad-gate";
import { channels } from "@/config/site.config";

test("privacy policy is reachable from the footer and explains the no-storage rule", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute("href", "/privacy");

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("개인정보처리방침");
  await expect(page.getByText("입력한 번호와 조회 결과는 서버 데이터베이스에 저장하지 않습니다.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "톡톡으로 문의하기" })).toHaveAttribute("target", "_blank");
});

const AD_TIMING_DISCLOSURE: Readonly<Record<AdTimingPolicy, string>> = {
  afterScrub: "사이트 첫 주소(tracking.tipoasis.com/)로 바꾼 뒤에만 광고 코드를 불러옵니다.",
  afterAllowedResult: "조회 결과가 광고를 보여도 되는 상태로 확인된 뒤에만 광고 코드를 불러옵니다.",
  neverOnNumberRoutes: "조회번호가 들어간 주소로 들어온 화면에서는 광고 코드를 불러오지 않습니다."
};

test("privacy policy discloses page addresses, access logs, customs lookup forwarding and tab-only storage", async ({
  page
}) => {
  await page.goto("/privacy");
  const policy = page.locator("main");
  const disclosures = [
    "입력한 번호와 조회 결과는 서버 데이터베이스에 저장하지 않습니다.",
    "지금 보고 있는 페이지 주소를 Google에 보냅니다.",
    AD_TIMING_DISCLOSURE[AD_TIMING_POLICY],
    "접속 로그에는 요청한 페이지 주소도 함께 남습니다.",
    "통관 조회 서비스(customstrack.com)",
    "이 브라우저 탭 안(세션 저장소)에만 보관합니다.",
    "보관한 정보는 30분이 지나면 다시 쓰지 않습니다.",
    // Browsers restore sessionStorage for a reopened (Ctrl+Shift+T) or duplicated tab, so the policy must say so.
    "닫은 탭을 다시 열거나 탭을 복제하면 30분 안에는 다시 보일 수 있습니다.",
    "공용 PC에서는 조회를 마친 뒤 브라우저를 모두 닫아 주세요.",
    "[다시 볼 링크 복사]로 만든 링크에는 조회번호가 들어 있습니다."
  ];
  for (const text of disclosures) {
    await expect(policy.getByText(text, { exact: false }).first(), text).toBeVisible();
  }
  for (const overstated of ["탭을 닫으면 바로 지워집니다", "다른 탭이나 다른 기기에서는 보이지 않습니다"]) {
    await expect(policy.getByText(overstated, { exact: false }), overstated).toHaveCount(0);
  }
  const effective = policy.getByText(/^시행일: /);
  await expect(effective).toHaveText(/^시행일: \d{4}년 \d{1,2}월 \d{1,2}일$/);
  await expect(effective).not.toHaveText("시행일: 2026년 9월 3일");
  await expect(policy.getByRole("heading", { level: 2, name: "8. 문의 채널" })).toBeVisible();
});

test("the privacy page sits on the token shell with the configured 톡톡 contact (S08)", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.locator(".tt-legacy-dark, .brand-panel, .section-title")).toHaveCount(0);
  const main = page.locator("main#main-content");
  const colors = await main.evaluate((element) => {
    const probe = (value: string): string => {
      const span = document.createElement("span");
      span.style.color = value;
      document.body.append(span);
      const rgb = getComputedStyle(span).color;
      span.remove();
      return rgb;
    };
    const root = getComputedStyle(document.documentElement);
    return {
      surface: probe(root.getPropertyValue("--tt-surface").trim()),
      ink: probe(root.getPropertyValue("--tt-ink").trim()),
      background: getComputedStyle(element).backgroundColor,
      color: getComputedStyle(element).color
    };
  });
  expect(colors.background).toBe(colors.surface);
  expect(colors.color).toBe(colors.ink);
  const contact = main.getByRole("link", { name: `${channels.talk.labels.cta} 새 창으로 열기` });
  await expect(contact).toHaveAttribute("href", channels.talk.url);
  await expect(contact).toHaveAttribute("target", "_blank");
  await expect(contact).toHaveAttribute("data-link-placement", "state");
});
