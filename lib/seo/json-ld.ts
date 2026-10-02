import type { GuideFaqEntry } from "@/lib/guides/guides";
import { SITE_ORIGIN } from "@/lib/site";

/** schema.org structured data for search engines (10월 2일 요청 ②). Data blocks only: browsers never run them. */
const CONTEXT = "https://schema.org";

/** Header brand name, used in page titles. */
export const SITE_NAME = "통관·배송 조회";

export interface FaqPageJsonLd {
  readonly "@context": typeof CONTEXT;
  readonly "@type": "FAQPage";
  readonly mainEntity: ReadonlyArray<{
    readonly "@type": "Question";
    readonly name: string;
    readonly acceptedAnswer: { readonly "@type": "Answer"; readonly text: string };
  }>;
}

export function faqJsonLd(entries: readonly GuideFaqEntry[]): FaqPageJsonLd {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer }
    }))
  };
}

export interface BreadcrumbJsonLd {
  readonly "@context": typeof CONTEXT;
  readonly "@type": "BreadcrumbList";
  readonly itemListElement: ReadonlyArray<{
    readonly "@type": "ListItem";
    readonly position: number;
    readonly name: string;
    readonly item: string;
  }>;
}

export function breadcrumbJsonLd(crumbs: ReadonlyArray<{ readonly name: string; readonly path: string }>): BreadcrumbJsonLd {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${SITE_ORIGIN}${crumb.path}`
    }))
  };
}

/** JSON for a <script type="application/ld+json"> body: every "<" is escaped so the text can never close the element. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
