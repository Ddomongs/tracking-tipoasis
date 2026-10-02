import type { Metadata } from "next";
import { getSiteConfig } from "@/lib/config/server";
import { DM_Mono, IBM_Plex_Mono, JetBrains_Mono } from "next/font/google";
import { DEFAULT_STYLE_ID } from "@/lib/style/styles";
import { style as styleConfig } from "@/config/site.config";
import { PREPAINT_SCRIPT, PREPAINT_SCRIPT_ID } from "@/lib/style/prepaint";
import { SHARE_IMAGE_URL } from "@/lib/seo/share-image";
import { searchVerification } from "@/lib/seo/verification";
import { SITE_TITLE } from "@/lib/site";
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

// Digit fonts of the other two styles: never preloaded, and referenced only by their style's token block
// (app/styles/style-manifest.css, style-night.css), so a browser downloads one only when that style is on screen.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: "600",
  display: "swap",
  preload: false,
  variable: "--font-plex-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: "500",
  display: "swap",
  preload: false,
  variable: "--font-jetbrains-mono",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
});

// Search and share copy for anyone who lands here from a search engine, not only our own customers (10월 2일 요청 ②).
// Every metadata tag is written twice ('/' HTML and its RSC payload) under the 35 KB '/' HTML budget: only what a
// share preview needs is set (og:url repeats the canonical link, html[lang] gives the locale).
const SITE_DESCRIPTION = "HBL·운송장 번호 하나로 해외 직구 통관과 택배 배송을 한 화면에서 확인하세요.";

export const metadata: Metadata = {
  metadataBase: new URL("https://tracking.tipoasis.com"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    title: SITE_TITLE,
    images: [SHARE_IMAGE_URL]
  },
  verification: searchVerification(process.env)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Validates config/site.config.ts: an invalid operator config fails `next build` with Korean 'path: message' lines.
  getSiteConfig();
  return (
    <html
      lang="ko"
      data-style={DEFAULT_STYLE_ID}
      data-follow-dark={styleConfig.followSystemDark ? "1" : "0"}
      className={`${monoFont.variable} ${plexMono.variable} ${jetbrainsMono.variable}`}
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
