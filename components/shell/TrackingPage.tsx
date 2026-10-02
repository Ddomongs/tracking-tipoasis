import { LookupController } from "@/components/lookup/LookupController";
import { TypicalDurations } from "@/components/lookup/TypicalDurations";
import { StoreShowcase } from "@/components/supplementary/StoreShowcase";
import { ShowcaseReachedSignal } from "@/components/ads/ShowcaseReachedSignal";
import { lookup, notices } from "@/config/site.config";
import { pickNotice, toNoticeView } from "@/lib/tracking/notices";
import type { NoticeView, TrackingEntry } from "@/lib/tracking/types";

/** The home banner of this render: '/' is static, so this runs at build time and then at most every 5 minutes. */
function currentHomeNotice(): NoticeView | null {
  const notice = pickNotice(notices, new Date(), { kind: "home" });
  return notice === null ? null : toNoticeView(notice);
}

/**
 * Server shell of '/' and '/{번호}' (spec §3 "두 라우트는 같은 서버 셸", §14). The only client island is LookupController.
 * `entry`: home; a valid deep link (painted as the number bar + '조회하고 있어요'); an INVALID deep link (the form with
 * the error, no API call). Without JavaScript a deep link says why no result appears (spec §3 noscript).
 */
export function TrackingPage({ entry }: { readonly entry: TrackingEntry }): React.JSX.Element {
  const homeNotice = entry.kind === "home" ? currentHomeNotice() : null;
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-[var(--tt-column)] bg-tt-surface text-tt-ink outline-none"
    >
      {entry.kind === "home" ? null : (
        <noscript>
          <p className="m-0 border-b border-tt-rule bg-tt-ground px-[var(--tt-gutter)] py-3 text-tt-sm font-bold text-tt-ink [word-break:keep-all]">
            {lookup.copy.noscriptNotice}
          </p>
        </noscript>
      )}
      {/* LookupController keeps the transitional #tracking-panel wrapper (Addition 11) around its lookup section. */}
      <LookupController
        entry={entry}
        homeNotice={homeNotice}
        idleExtras={<IdleExtras />}
        idleHero={entry.kind === "home" ? <HomeHero /> : null}
      />
    </main>
  );
}

/**
 * The home delivery scene (10월 2일 요청 ③④): a decorative animated SVG that plays about 4 s once inside the image file
 * (reduced motion: the last frame at once). Width and height on each source keep the space reserved (no layout shift).
 */
function HomeHero(): React.JSX.Element {
  return (
    <div data-home-hero="true">
      <picture>
        <source media="(min-width: 640px)" srcSet="/art/hero.svg" width={560} height={150} />
        <img src="/art/hero-m.svg" alt="" width={560} height={86} fetchPriority="high" />
      </picture>
    </div>
  );
}

/** Below the first view, idle mode only (spec §4 order): typical durations, then the store showcase. */
function IdleExtras(): React.JSX.Element {
  return (
    <>
      <div className="px-[var(--tt-gutter)] pb-6">
        <TypicalDurations />
      </div>
      <ShowcaseReachedSignal />
      <StoreShowcase />
    </>
  );
}
