import { Button } from "@/components/primitives/Button";
import type { HelpItemView, TrackingViewModel } from "@/lib/tracking/types";
import { openDetails } from "./details";
import { HelpItems } from "./HelpItems";
import { HistoryEventItem } from "./HistoryDetails";

const RECENT_HEADING = "처리 내역";
const SHOW_ALL = "전체 보기";

export interface SideColumnProps {
  readonly view: TrackingViewModel;
  readonly frame: "responsive" | "mobile";
  readonly historyId: string;
  readonly help: readonly HelpItemView[];
}

/**
 * Right column on desktop (spec §3 데스크톱 1440: 320 px beside the 560 px result): the newest three events with
 * '전체 보기' (opens 처리 내역) and the help items. Below 1024 px — and always in the mobile frame — it follows the main
 * column and the recent list is not shown, because the 처리 내역 details already hold the history.
 */
export function SideColumn({ view, frame, historyId, help }: SideColumnProps): React.JSX.Element | null {
  const recent = view.history.recent;
  const showRecent = frame === "responsive" && recent.length > 0;
  if (!showRecent && help.length === 0) return null;
  return (
    <div data-side-column="true" className="flex min-w-0 flex-col gap-4">
      {showRecent ? (
        <section
          data-history-recent="true"
          aria-labelledby={`${historyId}-recent`}
          className="hidden flex-col gap-3 bg-tt-surface px-4 py-4 text-tt-ink lg:flex"
        >
          <h3 id={`${historyId}-recent`} className="m-0 text-tt-sm font-bold">
            {RECENT_HEADING}
          </h3>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {recent.map((event, index) => (
              <HistoryEventItem key={`${event.at}-${index}`} event={event} />
            ))}
          </ol>
          <Button variant="text" aria-controls={historyId} onClick={() => openDetails(historyId)}>
            {SHOW_ALL}
          </Button>
        </section>
      ) : null}
      <HelpItems items={help} />
    </div>
  );
}
