"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { disclosures } from "@/config/site.config";
import type { EtaView, StoreLinksView, TrackingViewModel } from "@/lib/tracking/types";

const NEW_WINDOW_SUFFIX = " 새 창으로 열기";
const BAND_LABEL = "도착 예상과 바로가기";

/** One short line for the band: the same ETA the status card shows, without the big-number layout. */
export function etaSummaryText(eta: EtaView): string | null {
  switch (eta.kind) {
    case "none":
      return null;
    case "date":
      return `${eta.label} ${eta.date.label} · D-${eta.dday}`;
    case "today":
      return `${eta.label} · ${eta.date.label}`;
    case "holidayAffected":
      return `${eta.label} ${eta.date.label} · ${eta.badge}`;
    case "overdue":
    case "deliveredOn":
      return `${eta.label} ${eta.date.label}`;
    case "pendingInfo":
    case "withheld":
    case "unknown":
      return `${eta.label} · ${eta.text}`;
  }
}

/**
 * Shown once the status card has scrolled under the sticky header (the customer's request, 10월 2일): the ETA and, only in
 * states that already offer stores (delivered lead, pending purchase choices), the same store links with the definitive
 * disclosure. 톡톡 stays in the sticky header, so the screen keeps at most three 톡톡 places (spec §8). Fixed under the
 * header and mounted only while the card is out of view, so it moves nothing in the page (CLS) and is absent at the top.
 * It renders only after an IntersectionObserver callback (client only), so the portal never runs on the server.
 */
export function StickySummary({ view }: { readonly view: TrackingViewModel }): React.JSX.Element | null {
  const [cardHidden, setCardHidden] = useState(false);
  const eta = view.mode === "settled" ? etaSummaryText(view.eta) : null;
  const stores: StoreLinksView | null = view.mode === "settled" ? view.nextAction.stores : null;
  const hasContent = eta !== null || (stores !== null && stores.links.length > 0);

  useEffect(() => {
    if (!hasContent) return undefined;
    const card = document.querySelector("[data-result-view] [data-guide-key]");
    if (card === null || typeof IntersectionObserver === "undefined") return undefined;
    const headerHeight = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry === undefined) return;
        setCardHidden(!entry.isIntersecting && entry.boundingClientRect.top < headerHeight);
      },
      { rootMargin: `-${Math.round(headerHeight)}px 0px 0px 0px` }
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [hasContent, view]);

  if (!hasContent || !cardHidden) return null;
  const hasAffiliate = stores?.links.some((link) => link.isAffiliate) ?? false;
  // A portal to <body>: the band is a fixed overlay, not part of the result's structure (S08 style-independence scan).
  return createPortal(
    <aside
      aria-label={BAND_LABEL}
      data-sticky-summary="true"
      data-ad-exclude="true"
      className="fixed inset-x-0 top-[var(--tt-header-h)] z-30 border-b border-tt-rule bg-tt-surface text-tt-ink shadow-none"
    >
      <div className="mx-auto flex w-full max-w-[var(--tt-column)] flex-col gap-1 px-[var(--tt-gutter)] py-2">
        {eta === null ? null : <p className="m-0 text-tt-sm font-bold [word-break:keep-all]">{eta}</p>}
        {stores === null || stores.links.length === 0 ? null : (
          <>
            {hasAffiliate ? (
              <p className="m-0 text-tt-xs text-tt-muted [word-break:keep-all]">{stores.disclosure ?? disclosures.coupang}</p>
            ) : null}
            <div className="flex flex-wrap gap-x-4">
              {stores.links.map((link) => (
                <a
                  key={`${link.channel}-${link.href}`}
                  href={link.href}
                  target="_blank"
                  rel={link.isAffiliate ? "sponsored nofollow noopener noreferrer" : "noopener noreferrer"}
                  aria-label={`${link.label}${NEW_WINDOW_SUFFIX}`}
                  data-sticky-store={link.channel}
                  className="tt-focus inline-flex min-h-[44px] items-center text-tt-sm font-bold text-tt-link underline decoration-2 underline-offset-[5px]"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>,
    document.body
  );
}
