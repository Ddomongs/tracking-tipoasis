import { durations, lookup, resultCopy } from "@/config/site.config";
import type { StationId } from "@/lib/tracking/types";

const STATION_NAMES: Readonly<Record<StationId, string>> = {
  departed: resultCopy.stationDeparted,
  customs: resultCopy.stationCustoms,
  domestic: resultCopy.stationDomestic,
  arrived: resultCopy.stationArrived
};

/** '보통 이렇게 걸려요' (spec §4 "첫 화면 아래"): the four journey stations with their usual durations from config. */
export function TypicalDurations(): React.JSX.Element {
  return (
    <details className="border-b border-t-2 border-b-tt-rule border-t-tt-ink text-tt-ink">
      <summary className="tt-focus flex min-h-12 cursor-pointer items-center text-tt-md font-bold">{lookup.copy.typicalSummary}</summary>
      <dl className="m-0 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 pb-4 text-tt-sm">
        {durations.typical.map((row) => (
          <div key={row.station} className="contents">
            <dt className="font-bold">{STATION_NAMES[row.station]}</dt>
            <dd className="m-0 [word-break:keep-all]">{row.text}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
