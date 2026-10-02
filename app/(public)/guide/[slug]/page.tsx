import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/primitives/ButtonLink";
import { GUIDE_LINK_CLASS, GuideShell } from "@/components/seo/GuideShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { GUIDES, GUIDES_UPDATED, GUIDE_SLUGS, guideBySlug } from "@/lib/guides/guides";
import { SITE_NAME, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { SHARE_IMAGE_URL } from "@/lib/seo/share-image";

type GuideParams = Promise<{ readonly slug: string }>;

// Only the listed guides exist: any other slug is a real 404 at build time and at request time.
export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { readonly params: GuideParams }): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  if (guide === null) return {};
  const path = `/guide/${guide.slug}`;
  return {
    title: `${guide.title} | ${SITE_NAME}`,
    description: guide.summary,
    alternates: { canonical: path },
    openGraph: { type: "article", url: path, title: guide.title, description: guide.summary, images: [SHARE_IMAGE_URL] }
  };
}

/** One guide (10월 2일 요청 ②): static article, breadcrumbs, official sources and related guides. */
export default async function GuidePage({ params }: { readonly params: GuideParams }) {
  const guide = guideBySlug((await params).slug);
  if (guide === null) notFound();
  const path = `/guide/${guide.slug}`;
  const related = GUIDES.filter((other) => other.slug !== guide.slug);
  return (
    <GuideShell
      crumbs={[
        { name: "홈", href: "/" },
        { name: "통관 가이드", href: "/guide" },
        { name: guide.title, href: null }
      ]}
    >
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "통관 가이드", path: "/guide" },
          { name: guide.title, path }
        ])}
      />
      {guide.faq.length > 0 ? <JsonLd data={faqJsonLd(guide.faq)} /> : null}
      <article className="mt-4 flex flex-col gap-6">
        <header className="flex flex-col gap-2 border-b-2 border-tt-ink pb-4">
          <h1 className="m-0 text-tt-xl font-black [word-break:keep-all]">{guide.title}</h1>
          <p className="m-0 text-tt-md [word-break:keep-all]">{guide.summary}</p>
          <p className="m-0 text-tt-xs text-tt-muted">마지막 확인: {GUIDES_UPDATED}</p>
        </header>

        {guide.faq.map((entry) => (
          <section key={entry.question} className="flex flex-col gap-2">
            <h2 data-faq-question className="m-0 text-tt-lg font-bold [word-break:keep-all]">
              {entry.question}
            </h2>
            <p className="m-0 text-tt-sm leading-6 [word-break:keep-all]">{entry.answer}</p>
          </section>
        ))}

        {guide.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-3">
            <h2 className="m-0 text-tt-lg font-bold [word-break:keep-all]">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="m-0 text-tt-sm leading-6 [word-break:keep-all]">
                {paragraph}
              </p>
            ))}
            {section.items.length > 0 ? (
              <ul className="m-0 flex flex-col gap-2 pl-5 text-tt-sm leading-6">
                {section.items.map((item) => (
                  <li key={item} className="[word-break:keep-all]">
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <section aria-labelledby="guide-sources" className="flex flex-col gap-3">
          <h2 id="guide-sources" className="m-0 text-tt-lg font-bold">
            공식 안내
          </h2>
          <p className="m-0 text-tt-sm leading-6 [word-break:keep-all]">
            이 글은 이해를 돕기 위한 요약이에요. 기준은 바뀔 수 있으니 정확한 내용은 관세청 공식 안내를 확인해 주세요.
          </p>
          <div className="flex flex-wrap gap-2">
            {guide.sources.map((source) => (
              <ButtonLink key={source.url} href={source.url} variant="secondary" external label={source.label} />
            ))}
          </div>
        </section>

        <nav aria-labelledby="guide-related" className="flex flex-col gap-3">
          <h2 id="guide-related" className="m-0 text-tt-lg font-bold">
            함께 보면 좋은 글
          </h2>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {related.map((other) => (
              <li key={other.slug}>
                <Link href={`/guide/${other.slug}`} className={`${GUIDE_LINK_CLASS} inline-flex min-h-[44px] items-center text-tt-sm font-bold`}>
                  {other.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </GuideShell>
  );
}
