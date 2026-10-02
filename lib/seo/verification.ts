import type { Metadata } from "next";

/**
 * Search console ownership tags (docs/ops/search-registration.md). The codes are public (they end up in the HTML), so
 * they live in Vercel environment variables only to avoid a code change per console: GOOGLE_SITE_VERIFICATION and
 * NAVER_SITE_VERIFICATION. A missing or blank value adds no tag.
 */
const CODE = /^[A-Za-z0-9_-]{8,128}$/;

function code(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return CODE.test(trimmed) ? trimmed : null;
}

export function searchVerification(env: Readonly<Record<string, string | undefined>>): Metadata["verification"] {
  const google = code(env.GOOGLE_SITE_VERIFICATION);
  const naver = code(env.NAVER_SITE_VERIFICATION);
  if (google === null && naver === null) return undefined;
  return {
    ...(google === null ? {} : { google }),
    ...(naver === null ? {} : { other: { "naver-site-verification": naver } })
  };
}
