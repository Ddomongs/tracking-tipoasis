import { AdLoader } from "@/components/ads/AdLoader";
import { LiveAnnouncerProvider } from "@/components/primitives/LiveAnnouncer";
import { BottomBar } from "@/components/shell/BottomBar";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { SiteHero } from "@/components/shell/SiteHero";

/**
 * Public pages: /, /{번호}, /privacy (spec §14 "app/(public)/layout.tsx: 헤더, 푸터, live region·AdLoader 자리").
 * The style is switched by the header's round day/night button only (10월 2일 요청: the '화면 스타일' picker above the footer
 * is gone from public pages; /internal/ui-kit keeps it to preview all three styles).
 * The one polite live region exists here before any announcement (spec §5). The AdSense loader stays last and fail-closed (S02).
 */
export default function PublicLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <LiveAnnouncerProvider>
      <SiteHeader />
      <SiteHero />
      {children}
      <SiteFooter />
      <BottomBar />
      <AdLoader />
    </LiveAnnouncerProvider>
  );
}
