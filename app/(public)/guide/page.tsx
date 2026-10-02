import type { Metadata } from "next";
import Link from "next/link";
import { GUIDE_LINK_CLASS, GuideShell } from "@/components/seo/GuideShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { GUIDES } from "@/lib/guides/guides";
import { SITE_NAME, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { SHARE_IMAGE_URL } from "@/lib/seo/share-image";

const DESCRIPTION = "해외 직구·구매대행 물건의 통관 단계, 통관이 늦어지는 이유, 개인통관고유부호, 택배 조회 요령을 쉽게 정리했어요.";

export const metadata: Metadata = {
  title: `통관 가이드 | ${SITE_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: "/guide" },
  openGraph: { type: "website", url: "/guide", title: "통관 가이드", description: DESCRIPTION, images: [SHARE_IMAGE_URL] }
};

/** Guide index (10월 2일 요청 ②): static, no client code. */
export default function GuideIndexPage() {
  return (
    <GuideShell crumbs={[{ name: "홈", href: "/" }, { name: "통관 가이드", href: null }]}>
      <JsonLd data={breadcrumbJsonLd([{ name: "통관 가이드", path: "/guide" }])} />
      <article className="mt-4 flex flex-col gap-6">
        <header className="flex flex-col gap-2 border-b-2 border-tt-ink pb-4">
          <h1 className="m-0 text-tt-xl font-black [word-break:keep-all]">통관 가이드</h1>
          <p className="m-0 text-tt-md [word-break:keep-all]">{DESCRIPTION}</p>
        </header>
        <ul className="m-0 flex list-none flex-col gap-5 p-0">
          {GUIDES.map((guide) => (
            <li key={guide.slug} className="flex flex-col gap-1">
              <Link href={`/guide/${guide.slug}`} className={`${GUIDE_LINK_CLASS} text-tt-lg font-bold [word-break:keep-all]`}>
                {guide.title}
              </Link>
              <p className="m-0 text-tt-sm leading-6 text-tt-muted [word-break:keep-all]">{guide.summary}</p>
            </li>
          ))}
        </ul>
      </article>
    </GuideShell>
  );
}
