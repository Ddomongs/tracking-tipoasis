import { serializeJsonLd } from "@/lib/seo/json-ld";

/** One schema.org data block (10월 2일 요청 ②). A data block is never executed, so it needs no CSP hash. */
export function JsonLd({ data }: { readonly data: unknown }): React.JSX.Element {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
