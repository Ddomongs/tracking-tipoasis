import { AdLoader } from "@/components/ads/AdLoader";

export default function PublicLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <>
      {children}
      <AdLoader />
    </>
  );
}
