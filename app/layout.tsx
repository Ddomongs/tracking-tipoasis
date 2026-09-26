import type { Metadata } from "next";
import { IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";

const bodyFont = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-body",
  preload: false
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
  return (
    <html lang="ko">
      <body className={`${bodyFont.variable} google-anno-skip antialiased`}>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
