import type { LastEventView } from "@/lib/tracking/types";

const LAST_EVENT_LABEL = "마지막 처리";

/** 마지막 처리 (spec §6 상세): '9월 23일 (수) 14:10 · 통관 접수', the place, and the original term in small print. */
export function LastEventLine({ lastEvent }: { readonly lastEvent: LastEventView | null }): React.JSX.Element | null {
  if (lastEvent === null) return null;
  return (
    <p
      data-last-event="true"
      className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-[var(--tt-gutter)] text-tt-sm text-tt-ink [overflow-wrap:anywhere] [word-break:keep-all]"
    >
      <span className="font-bold">{LAST_EVENT_LABEL}</span>
      <span>{lastEvent.place === null ? lastEvent.text : `${lastEvent.text} · ${lastEvent.place}`}</span>
      {lastEvent.original === null ? null : <span className="text-tt-xs text-tt-muted">{lastEvent.original}</span>}
    </p>
  );
}
