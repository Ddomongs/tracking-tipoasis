import { expect, test } from "@playwright/test";
import { ADSENSE_CLIENT_ID, ADSENSE_LOADER_URL, ADSENSE_PUBLISHER_DIGITS, SITE_ORIGIN, buildReturnLink } from "@/lib/site";
import { FAKE, FAKE_GROUPED } from "../fixtures/tracking-fixtures";

test("site constants match the production origin and the AdSense account", () => {
  expect(SITE_ORIGIN).toBe("https://tracking.tipoasis.com");
  expect(ADSENSE_CLIENT_ID).toBe("ca-pub-7351210358018620");
  expect(ADSENSE_CLIENT_ID).toBe(`ca-pub-${ADSENSE_PUBLISHER_DIGITS}`);
  expect(ADSENSE_LOADER_URL).toBe(
    `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`
  );
});

test("buildReturnLink encodes the number and adds ?c= only for a chosen carrier", () => {
  expect(buildReturnLink(FAKE.domestic, "AUTO")).toBe(`${SITE_ORIGIN}/${FAKE.domestic}`);
  expect(buildReturnLink(FAKE.hbl, "CJ")).toBe(`${SITE_ORIGIN}/${FAKE.hbl}?c=CJ`);
  expect(buildReturnLink(FAKE_GROUPED.domestic, "HANJIN")).toBe(`${SITE_ORIGIN}/0000%201234%205678?c=HANJIN`);
});
