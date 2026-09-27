import type { SpineView, StationId } from "@/lib/tracking/types";
import { ToneIcon } from "./ToneIcon";

const STATIONS: ReadonlyArray<{ readonly id: StationId; readonly name: string }> = [
  { id: "departed", name: "해외 출발" },
  { id: "customs", name: "입항·통관" },
  { id: "domestic", name: "국내 배송" },
  { id: "arrived", name: "도착" }
];

const DEFAULT_LABEL = "배송 여정 4구간";
const UNKNOWN_TEXT = "위치 확인 전";
const HANDOFF_TEXT = "인계 대기";

type StationState = "done" | "current" | "todo";

function stationState(index: number, currentIndex: number): StationState {
  if (currentIndex < 0 || index > currentIndex) return "todo";
  return index === currentIndex ? "current" : "done";
}

/**
 * The one progress figure of the result (spec §6): ①해외 출발 ②입항·통관 ③국내 배송 ④도착.
 * Exactly one aria-current="step" when the location is known, none before (spine.current === null).
 * Issue marks (멈춤·끊김·갈림) are color + icon + the word from the view; the issue station can be
 * ahead of the current one (a carrier delay while customs is current). Code 4 keeps ② current with a
 * check mark and '인계 대기'. The look belongs to the `journey` slot in app/styles/tokens.css.
 */
export function JourneySpine({ spine, label = DEFAULT_LABEL }: { readonly spine: SpineView; readonly label?: string }): React.JSX.Element {
  const currentIndex = spine.current === null ? -1 : STATIONS.findIndex((station) => station.id === spine.current);
  return (
    <div data-slot="journey">
      <ol aria-label={label} data-spine-current={spine.current ?? "none"}>
        {STATIONS.map((station, index) => {
          const state = stationState(index, currentIndex);
          const issue = spine.issue !== null && spine.issue.at === station.id ? spine.issue : null;
          const handoff = state === "current" && station.id === "customs" && spine.handoffPending;
          return (
            <li
              key={station.id}
              data-station={station.id}
              data-station-state={state}
              data-issue={issue?.kind}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span data-spine-part="track" aria-hidden="true">
                <span data-spine-part="bar">{issue ? <ToneIcon tone="attention" issue={issue.kind} /> : null}</span>
              </span>
              <span data-spine-part="label">
                {issue ? <span data-spine-part="issue">{issue.label}</span> : null}
                <span data-spine-part="name">
                  {state === "done" || handoff ? <ToneIcon tone="done" /> : null}
                  {station.name}
                </span>
                {handoff ? <span data-spine-part="sub">{HANDOFF_TEXT}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {spine.current === null ? <p data-spine-part="unknown">{UNKNOWN_TEXT}</p> : null}
    </div>
  );
}
