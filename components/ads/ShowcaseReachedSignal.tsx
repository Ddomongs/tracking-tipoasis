"use client";

import { useEffect, useRef } from "react";
import { setAdSignals } from "@/lib/ads/ad-signals";

/**
 * Approval 7, home: the ad loader may load once the customer has scrolled down to the store showcase (spec §7 idle,
 * §16 item 7). An aria-hidden sentinel at the end of the idle blocks (right above the store sheet in the DOM; 10월 2일부터 the sheet is a popover or a side panel) that reports only after a real scroll (scrollY > 0),
 * so a tall window that shows the showcase without scrolling does not count.
 */
export function ShowcaseReachedSignal(): React.JSX.Element {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (sentinel === null || typeof IntersectionObserver === "undefined") return undefined;
    let visible = false;
    const report = (): void => {
      if (!visible || window.scrollY <= 0) return;
      setAdSignals({ scrolledPastLookup: true });
      cleanup();
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      report();
    });
    function cleanup(): void {
      observer.disconnect();
      window.removeEventListener("scroll", report);
    }
    observer.observe(sentinel);
    window.addEventListener("scroll", report, { passive: true });
    return cleanup;
  }, []);

  return <div ref={sentinelRef} data-ad-scroll-sentinel="showcase" aria-hidden="true" className="h-px" />;
}
