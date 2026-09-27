import { LookupController } from "@/components/lookup/LookupController";
import { StorefrontShowcase } from "@/components/StorefrontShowcase";
import type { TrackingEntry } from "@/lib/tracking/types";

/**
 * Server shell of '/' and '/{번호}' (spec §3 "두 라우트는 같은 서버 셸", §14). The only client island is LookupController.
 * `entry`: home; a valid deep link (painted as the number bar + '조회하고 있어요'); an INVALID deep link (the form with
 * the error, no API call). LookupController keeps the transitional `#tracking-panel` wrapper (Addition 11) that S04's E2E helpers select.
 */
export function TrackingPage({ entry }: { readonly entry: TrackingEntry }): React.JSX.Element {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-[var(--tt-column)] bg-tt-surface text-tt-ink outline-none"
    >
      <LookupController entry={entry} homeNotice={null} idleExtras={<IdleExtras />} />
    </main>
  );
}

/** Below the first view, idle mode only (spec §4 "첫 화면 아래"). S08 replaces the legacy showcase with StoreShowcase. */
function IdleExtras(): React.JSX.Element {
  return (
    <div className="tt-legacy-dark px-4 py-6">
      <StorefrontShowcase />
    </div>
  );
}
