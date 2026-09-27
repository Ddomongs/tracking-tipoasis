import type { SiteConfig } from "@/lib/config/types";
import type { DataGuideKey } from "@/lib/tracking/derive/keys";
import type { SpineView, StationId } from "@/lib/tracking/types";
import type { StatusCode, TrackResponseData } from "@/lib/types";

export const STATIONS: readonly StationId[] = ["departed", "customs", "domestic", "arrived"];
export const EMPTY_SPINE: SpineView = { current: null, issue: null, handoffPending: false, positionLabel: null };

const CODE_BASED_KEYS: ReadonlySet<DataGuideKey> = new Set<DataGuideKey>([
  "customsArrived", "customsWaiting", "customsCleared", "handedToCarrier", "pickedUp", "inTransit"
]);

/** Codes 1–4 → 입항·통관 (4 adds '인계 대기'), 5–6 → 국내 배송, 7 → 도착. */
export function stationForCode(code: StatusCode): StationId {
  if (code <= 4) return "customs";
  if (code <= 6) return "domestic";
  return "arrived";
}

function currentStation(data: TrackResponseData, key: DataGuideKey): StationId | null {
  if (key === "pending") return null;
  if (key === "lookupUnavailable" || key === "ambiguous") return "domestic";
  return stationForCode(data.currentStatusCode);
}

function spineIssue(data: TrackResponseData, key: DataGuideKey, current: StationId, config: SiteConfig): SpineView["issue"] {
  const copy = config.resultCopy;
  const codeBased = CODE_BASED_KEYS.has(key);
  if (key === "stale") return { at: current, kind: "stopped", label: copy.issueStopped };
  if (key === "lookupUnavailable" || (codeBased && data.delivery.lookupUnavailable === true)) {
    return { at: "domestic", kind: "cut", label: copy.issueCut };
  }
  if (key === "ambiguous" || (codeBased && data.delivery.ambiguous === true)) {
    return { at: "domestic", kind: "branch", label: copy.issueBranch };
  }
  return null;
}

export function spineFor(data: TrackResponseData, key: DataGuideKey, config: SiteConfig): SpineView {
  const current = currentStation(data, key);
  if (current === null) return EMPTY_SPINE;
  return {
    current,
    issue: spineIssue(data, key, current, config),
    handoffPending: current === "customs" && data.currentStatusCode === 4,
    positionLabel: `${STATIONS.indexOf(current) + 1}/${STATIONS.length}`
  };
}
