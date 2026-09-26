import type { Metadata } from "next";

/** Internal CS pages: no ads, no analytics, no public chrome; never indexed, no referrer (spec §10). Basic auth stays in proxy.ts. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer"
};

export default function InternalLayout({ children }: { readonly children: React.ReactNode }) {
  return <>{children}</>;
}
