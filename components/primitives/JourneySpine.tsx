import type { SpineView, StationId } from "@/lib/tracking/types";
import { ToneIcon } from "./ToneIcon";

/** Station pictures (10월 2일 요청 ③): plane, customs house, truck, home. 24px line art in currentColor, hidden from AT. */
const STATIONS: ReadonlyArray<{ readonly id: StationId; readonly name: string; readonly icon: string }> = [
  { id: "departed", name: "해외 출발", icon: "M3,16L18,10C21,9,22,11,20,12L5,18Z M10,13L7,6H9.5L14,11.5 M11,16.5L12,21H14.5L15,14" },
  { id: "customs", name: "입항·통관", icon: "M4,9L12,4L20,9Z M4,20H20 M7,12V17 M12,12V17 M17,12V17" },
  { id: "domestic", name: "국내 배송", icon: "M2,6H14V16H2Z M14,9H18L21,12.5V16H14 M5,18.5A1.5,1.5,0,1,0,8,18.5A1.5,1.5,0,1,0,5,18.5Z M15,18.5A1.5,1.5,0,1,0,18,18.5A1.5,1.5,0,1,0,15,18.5Z" },
  { id: "arrived", name: "도착", icon: "M3,11L12,4L21,11 M5.5,9.5V20H18.5V9.5 M10,20V14H14V20" }
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
              <svg data-spine-part="icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
                <path d={station.icon} />
              </svg>
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
