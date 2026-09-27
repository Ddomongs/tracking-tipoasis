import type { HistoryEventView, HistoryView } from "@/lib/tracking/types";

/** One event of the vertical history: time, customer label (· place), original term. Never aria-current. */
export function HistoryEventItem({ event }: { readonly event: HistoryEventView }): React.JSX.Element {
  return (
    <li className="flex flex-col gap-0.5 border-0 border-l-2 border-solid border-tt-rule pl-3 [overflow-wrap:anywhere] [word-break:keep-all]">
      <time dateTime={event.at} className="text-tt-xs font-medium text-tt-muted">
        {event.timeText}
      </time>
      <span className="text-tt-sm font-bold">
        {event.label}
        {event.place === null ? null : <span className="font-medium"> · {event.place}</span>}
      </span>
      {event.original === null ? null : <span className="text-tt-xs text-tt-muted">{event.original}</span>}
    </li>
  );
}

/**
 * <details> '처리 내역 N건 보기 · 마지막 …' (spec §6 상세): closed by default; inside, the stations the shipment passed,
 * each with its events in time order. With no events it is one sentence instead of an empty box (spec §7 pending).
 */
export function HistoryDetails({ history, id }: { readonly history: HistoryView; readonly id: string }): React.JSX.Element | null {
  if (history.count === 0) {
    return history.emptyText === null ? null : (
      <p data-history-empty="true" className="m-0 px-[var(--tt-gutter)] text-tt-sm text-tt-muted [word-break:keep-all]">
        {history.emptyText}
      </p>
    );
  }
  return (
    <details id={id} data-history="true" className="bg-tt-surface px-[var(--tt-gutter)] text-tt-ink">
      <summary className="tt-focus flex min-h-[44px] cursor-pointer items-center text-tt-sm font-bold [word-break:keep-all]">
        {history.summaryText}
      </summary>
      <div className="flex flex-col gap-4 pb-4">
        {history.segments.map((segment) => (
          <section
            key={segment.station}
            data-history-segment={segment.station}
            aria-labelledby={`${id}-${segment.station}`}
            className="flex flex-col gap-2"
          >
            <h3 id={`${id}-${segment.station}`} className="m-0 text-tt-sm font-bold">
              {segment.title}
            </h3>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {segment.events.map((event, index) => (
                <HistoryEventItem key={`${event.at}-${index}`} event={event} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </details>
  );
}
