"use client";

import { useEffect } from "react";
import { ads, resultCopy } from "@/config/site.config";
import { ADSENSE_CLIENT_ID } from "@/lib/site";
import { useAdGateState } from "./useAdGateState";

type AdQueueWindow = Window & { adsbygoogle?: unknown[] };

/**
 * The one manual ad slot, right before the footer (spec §8). The box reserves its height before any fill (config.ads:
 * 280 px on phones, 250 px from 768 px) so a filled ad never shifts the page. The ad unit is inserted and requested only
 * while the ad gate is open (S02 candidate B and the ad-timing policy). `allowed` is the caller's placement decision.
 */
export function ManualAdSlot({
  allowed,
  slotId
}: {
  readonly allowed: boolean;
  readonly slotId: string | null;
}): React.JSX.Element | null {
  const gate = useAdGateState(null);
  const fill = allowed && slotId !== null && gate === "open";

  useEffect(() => {
    if (!fill) return;
    try {
      const queueWindow = window as AdQueueWindow;
      queueWindow.adsbygoogle = queueWindow.adsbygoogle ?? [];
      queueWindow.adsbygoogle.push({});
    } catch {
      // The loader reports its own errors; the reserved box simply stays empty.
    }
  }, [fill]);

  if (!allowed || slotId === null) return null;
  const reserve = {
    "--ad-min-mobile": `${ads.minHeightMobilePx}px`,
    "--ad-min-desktop": `${ads.minHeightDesktopPx}px`
  } as React.CSSProperties;
  return (
    <aside
      data-ad-slot="manual"
      aria-label={resultCopy.adSlotLabel}
      style={reserve}
      className="mx-auto block w-full max-w-[var(--tt-column)] min-h-[var(--ad-min-mobile)] md:min-h-[var(--ad-min-desktop)]"
    >
      {fill ? (
        <ins
          className="adsbygoogle block"
          data-ad-client={ADSENSE_CLIENT_ID}
          data-ad-slot={slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : null}
    </aside>
  );
}
