import type { Metadata } from "next";
import { InternalCsDesk } from "@/components/internal/InternalCsDesk";
import { parseInternalTab } from "@/components/internal/tabs";

export const metadata: Metadata = {
  title: "배송·통관 CS 데스크",
  description: "배송 안내 일괄 조회, 통관부호 불일치 안내, 안내표 미리보기와 공지 현황"
};

interface CsHelperPageProps {
  readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}

/** /internal/cs-helper — basic auth (proxy.ts), noindex and no-referrer come from the (internal) layout; ?tab= opens a tab. */
export default async function InternalCsHelperPage({ searchParams }: CsHelperPageProps): Promise<React.JSX.Element> {
  const { tab } = await searchParams;
  return <InternalCsDesk initialTab={parseInternalTab(tab)} />;
}
