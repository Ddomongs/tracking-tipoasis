"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AD_TIMING_POLICY, shouldInsertAdLoader } from "@/lib/ads/ad-gate";
import { getAdSignals, subscribeAdSignals } from "@/lib/ads/ad-signals";
import { containsTrackingLikeValue } from "@/lib/privacy/number-patterns";
import { ADSENSE_LOADER_URL } from "@/lib/site";

const LOADER_SELECTOR = 'script[data-ad-loader="adsense"]';
const IDLE_TIMEOUT_MS = 2000;

let insertScheduled = false;

function loaderPresent(): boolean {
  return document.querySelector(LOADER_SELECTOR) !== null;
}

function allowedNow(): boolean {
  const { pathname, search, hash } = window.location;
  if (new URLSearchParams(search).has("trackingNumber")) return false;
  if (containsTrackingLikeValue(`${search}${hash}`)) return false;
  return shouldInsertAdLoader({ ...getAdSignals(), pathname, policy: AD_TIMING_POLICY });
}

function insertLoader(): void {
  insertScheduled = false;
  // Re-checked at insertion time: the URL or the signals may have changed since scheduling.
  if (loaderPresent() || !allowedNow()) return;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = ADSENSE_LOADER_URL;
  script.dataset.adLoader = "adsense";
  // Never set data-page-url: AdSense would still send the real URL as loc= (GAP1-03).
  document.body.appendChild(script);
}

function scheduleInsert(): void {
  if (insertScheduled || loaderPresent() || !allowedNow()) return;
  insertScheduled = true;
  const whenIdle = (): void => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(insertLoader, { timeout: IDLE_TIMEOUT_MS });
    } else {
      window.setTimeout(insertLoader, 1);
    }
  };
  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
}

/**
 * Inserts the AdSense loader at most once per document, and only while the URL carries no tracking number
 * (spec §3 candidate B, §8). Replaces the former `next/script` tag; the SSR HTML carries no ad script.
 */
export function AdLoader(): null {
  // Only a re-evaluation trigger: client navigations and the scrub's replaceState change the pathname.
  const pathname = usePathname();
  useEffect(() => {
    scheduleInsert();
    return subscribeAdSignals(scheduleInsert);
  }, [pathname]);
  return null;
}
