import type { Metadata } from "next";
import { getSiteConfig } from "@/lib/config/server";
import { DM_Mono } from "next/font/google";
import { DEFAULT_STYLE_ID } from "@/lib/style/styles";
import { style as styleConfig } from "@/config/site.config";
import { PREPAINT_SCRIPT, PREPAINT_SCRIPT_ID } from "@/lib/style/prepaint";
import "./globals.css";
import "./styles/tokens.css";
import "./styles/style-manifest.css";
import "./styles/style-night.css";

// Signal (기본) keeps body and display text on the system Korean gothic (0 KB). The only web font is
// DM Mono 500, latin subset, for tracking-number digits: one preloaded file (spec §12 and §13 font budget).
const monoFont = DM_Mono({
  subsets: ["latin"],
  weight: "500",
  display: "swap",
  preload: true,
  variable: "--font-dm-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tracking.tipoasis.com"),
  title: "통관·국내 배송 한 번에 조회",
  description: "HBL 또는 운송장 번호로 통관 단계와 국내 배송 현황을 한 화면에서 확인하세요.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    title: "통관·국내 배송 한 번에 조회",
    description: "구매 고객을 위한 통관·국내 배송 통합 조회"
  },
  twitter: {
    card: "summary",
    title: "통관·국내 배송 한 번에 조회",
    description: "구매 고객을 위한 통관·국내 배송 통합 조회"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Validates config/site.config.ts: an invalid operator config fails `next build` with Korean 'path: message' lines.
  getSiteConfig();
  return (
    <html
      lang="ko"
      data-style={DEFAULT_STYLE_ID}
      data-follow-dark={styleConfig.followSystemDark ? "1" : "0"}
      className={monoFont.variable}
      suppressHydrationWarning
    >
      <head>
        {/* Sets html[data-style] before the first paint (spec §13); allowed by its hash in the CSP (lib/style/prepaint.ts). */}
        <script id={PREPAINT_SCRIPT_ID} dangerouslySetInnerHTML={{ __html: PREPAINT_SCRIPT }} />
      </head>
      <body className="font-tt-body google-anno-skip antialiased">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
