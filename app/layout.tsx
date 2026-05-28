import type { Metadata } from "next";
import Script from "next/script";
import { IBM_Plex_Sans_KR, Space_Grotesk } from "next/font/google";
import { SplineBackground } from "@/components/SplineBackground";
import "./globals.css";

const bodyFont = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body"
});

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "실시간 AI 배송 추적 시스템",
  description: "구매대행 고객을 위한 통관/배송 통합 조회"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${bodyFont.variable} ${displayFont.variable} antialiased`}>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7351210358018620"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
        <SplineBackground />
        <div className="relative z-10 pointer-events-none">{children}</div>
      </body>
    </html>
  );
}
