import type { MetadataRoute } from "next";

/** Installable app (11월 28일 요청): iPhone delivers web push only to a site added to the home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "통관·배송 조회 | 팁오아시스",
    short_name: "통관조회",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#2340D0",
    lang: "ko",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }]
  };
}
