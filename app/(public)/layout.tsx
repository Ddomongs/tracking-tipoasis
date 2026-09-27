import { AdLoader } from "@/components/ads/AdLoader";
import { LiveAnnouncerProvider } from "@/components/primitives/LiveAnnouncer";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { StylePicker } from "@/components/shell/StylePicker";

/**
 * Public pages: /, /{번호}, /privacy (spec §14 "app/(public)/layout.tsx: 헤더, 푸터, live region·AdLoader 자리").
 * The one polite live region exists here before any announcement (spec §5). The AdSense loader stays last and fail-closed (S02).
 */
export default function PublicLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <LiveAnnouncerProvider>
      <SiteHeader />
      {children}
      <StylePicker />
      <SiteFooter />
      <AdLoader />
    </LiveAnnouncerProvider>
  );
}
