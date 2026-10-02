import { expect, test } from "@playwright/test";
import sitemap from "@/app/sitemap";
import { GUIDES, GUIDE_SLUGS, guideBySlug } from "@/lib/guides/guides";
import { breadcrumbJsonLd, faqJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { searchVerification } from "@/lib/seo/verification";
import { SITE_ORIGIN } from "@/lib/site";

/** 10월 2일 요청: 검색으로 들어온 일반 사용자도 쓸 수 있도록 통관 정보 페이지를 둡니다. */
const OFFICIAL_HOSTS = new Set(["unipass.customs.go.kr", "www.customs.go.kr"]);

test("five guides with unique kebab-case slugs", () => {
  expect(GUIDE_SLUGS).toEqual(["customs-steps", "customs-delays", "customs-code", "carriers", "faq"]);
  expect(new Set(GUIDE_SLUGS).size).toBe(GUIDE_SLUGS.length);
  for (const slug of GUIDE_SLUGS) expect(slug).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
  expect(guideBySlug("faq")?.slug).toBe("faq");
  expect(guideBySlug("nope")).toBeNull();
});

test("every guide has a short title, a search-sized summary, sections and an official source", () => {
  for (const guide of GUIDES) {
    expect(guide.title.length, guide.slug).toBeLessThanOrEqual(30);
    expect(guide.summary.length, guide.slug).toBeGreaterThanOrEqual(40);
    expect(guide.summary.length, guide.slug).toBeLessThanOrEqual(120);
    expect(guide.sections.length, guide.slug).toBeGreaterThan(0);
    expect(guide.sources.length, guide.slug).toBeGreaterThan(0);
    for (const source of guide.sources) {
      const url = new URL(source.url);
      expect(url.protocol, source.url).toBe("https:");
      expect(OFFICIAL_HOSTS.has(url.hostname), source.url).toBe(true);
    }
  }
});

test("the FAQ guide carries at least five questions; the others carry none", () => {
  for (const guide of GUIDES) {
    if (guide.slug === "faq") expect(guide.faq.length).toBeGreaterThanOrEqual(5);
    else expect(guide.faq).toEqual([]);
  }
});

test("FAQPage JSON-LD mirrors the questions", () => {
  const faq = guideBySlug("faq")?.faq ?? [];
  const data = faqJsonLd(faq);
  expect(data["@context"]).toBe("https://schema.org");
  expect(data["@type"]).toBe("FAQPage");
  expect(data.mainEntity.map((entry) => entry.name)).toEqual(faq.map((entry) => entry.question));
  expect(data.mainEntity[0]).toEqual({
    "@type": "Question",
    name: faq[0]?.question,
    acceptedAnswer: { "@type": "Answer", text: faq[0]?.answer }
  });
});

test("BreadcrumbList JSON-LD uses absolute production URLs", () => {
  const crumbs = breadcrumbJsonLd([
    { name: "통관 가이드", path: "/guide" },
    { name: "자주 묻는 질문", path: "/guide/faq" }
  ]);
  expect(crumbs["@type"]).toBe("BreadcrumbList");
  expect(crumbs.itemListElement).toEqual([
    { "@type": "ListItem", position: 1, name: "통관 가이드", item: `${SITE_ORIGIN}/guide` },
    { "@type": "ListItem", position: 2, name: "자주 묻는 질문", item: `${SITE_ORIGIN}/guide/faq` }
  ]);
});

test("serializeJsonLd cannot close the script element", () => {
  const text = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
  expect(text).not.toContain("<");
  expect(JSON.parse(text)).toEqual({ name: "</script><script>alert(1)</script>" });
});

test("the sitemap lists the home, the guide index, every guide and the privacy page", () => {
  expect(sitemap().map((entry) => entry.url)).toEqual([
    `${SITE_ORIGIN}/`,
    `${SITE_ORIGIN}/guide`,
    ...GUIDE_SLUGS.map((slug) => `${SITE_ORIGIN}/guide/${slug}`),
    `${SITE_ORIGIN}/privacy`
  ]);
});

test("search console tags come only from well-formed environment values", () => {
  expect(searchVerification({})).toBeUndefined();
  expect(searchVerification({ GOOGLE_SITE_VERIFICATION: "  ", NAVER_SITE_VERIFICATION: '"><script>' })).toBeUndefined();
  expect(searchVerification({ GOOGLE_SITE_VERIFICATION: " abcDEF_12-xyz " })).toEqual({ google: "abcDEF_12-xyz" });
  expect(searchVerification({ NAVER_SITE_VERIFICATION: "naverCode_abc123" })).toEqual({
    other: { "naver-site-verification": "naverCode_abc123" }
  });
});
