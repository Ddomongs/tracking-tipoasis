import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { stateGuide } from "@/config/site.config";
import { TrackingPage } from "@/components/shell/TrackingPage";
import { classifyDeepLink, parseCarrierParam } from "@/lib/tracking/number-input";
import type { TrackingEntry } from "@/lib/tracking/types";

type TrackingPathPageProps = {
  readonly params: Promise<{ readonly trackingNumber: string }>;
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
};

const TITLE_SUFFIX = " · 배송 조회";

/** Next may hand over the raw segment; a malformed escape is kept as literal text and then fails the shape check. */
function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: TrackingPathPageProps): Promise<Metadata> {
  const { trackingNumber } = await params;
  const decision = classifyDeepLink(decodeSegment(trackingNumber));
  const docTitle = decision.kind === "invalid" ? stateGuide.invalidNumber.docTitle : stateGuide.loading.docTitle;
  return { title: `${docTitle}${TITLE_SUFFIX}`, robots: { index: false, follow: false } };
}

/**
 * '/{번호}' (spec §3): valid → the shell with the number bar and '조회하고 있어요' in the server HTML; alphanumeric 6–30
 * but not a number → the INVALID screen, no API call; anything else (a dot, Hangul, 31+ characters) → a real 404.
 * `?c=` carries the carrier. The document title never contains the number; X-Robots-Tag comes from next.config (S01).
 */
export default async function TrackingPathPage({ params, searchParams }: TrackingPathPageProps) {
  const [{ trackingNumber }, query] = await Promise.all([params, searchParams]);
  const decision = classifyDeepLink(decodeSegment(trackingNumber));
  if (decision.kind === "notFound") notFound();
  const entry: TrackingEntry =
    decision.kind === "valid"
      ? { kind: "deepLink", number: decision.number, carrier: parseCarrierParam(query.c) }
      : { kind: "invalidDeepLink", input: decision.input };
  return <TrackingPage entry={entry} />;
}
