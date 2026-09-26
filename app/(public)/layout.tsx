import Script from "next/script";
import { ADSENSE_LOADER_URL } from "@/lib/site";

/**
 * Public pages: /, /{번호}, /privacy. The AdSense loader lives only here, so /internal/* never loads it (spec §10).
 * S02 replaces this <Script> with <AdLoader/> (number-route privacy).
 */
export default function PublicLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <>
      <Script async src={ADSENSE_LOADER_URL} crossOrigin="anonymous" strategy="lazyOnload" />
      {children}
    </>
  );
}
