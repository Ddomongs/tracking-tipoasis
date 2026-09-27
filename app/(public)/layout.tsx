import { AdLoader } from "@/components/ads/AdLoader";
import { LiveAnnouncerProvider } from "@/components/primitives/LiveAnnouncer";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * Public pages: /, /{번호}, /privacy (spec §14 "app/(public)/layout.tsx: 헤더, 푸터, live region·AdLoader 자리").
 * The one polite live region exists here before any announcement (spec §5). The legacy footer sits on a dark band
 * until S08 replaces it with components/shell/SiteFooter.tsx. The AdSense loader stays last and fail-closed (S02).
 */
export default function PublicLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <LiveAnnouncerProvider>
      <SiteHeader />
      {children}
      <div className="tt-legacy-dark">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <SiteFooter />
        </div>
      </div>
      <AdLoader />
    </LiveAnnouncerProvider>
  );
}
