import type { SiteConfig } from "@/lib/config/types";
import { carrierDisplayName, carrierOfficialUrl } from "@/lib/tracking/carriers";
import type { DataGuideKey } from "@/lib/tracking/derive/keys";
import type { CarrierView, LookupRequest } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

/** States before a carrier is assigned show '택배사 배정 전' instead of a name. */
const UNASSIGNED_KEYS: ReadonlySet<DataGuideKey> = new Set<DataGuideKey>(["pending", "customsArrived", "customsWaiting", "customsCleared"]);

export function carrierForData(data: TrackResponseData, request: LookupRequest, key: DataGuideKey, config: SiteConfig): CarrierView {
  const code = data.delivery.carrierCode !== "AUTO" ? data.delivery.carrierCode : request.carrier;
  const name = carrierDisplayName(data.delivery.carrier, code);
  const invoice = data.delivery.invoiceNumber.length > 0 ? data.delivery.invoiceNumber : request.number;
  const fallback = UNASSIGNED_KEYS.has(key) ? config.resultCopy.carrierUnassigned : config.resultCopy.carrierUnknown;
  return {
    code,
    name,
    barLabel: name ?? fallback,
    officialUrl: data.delivery.trackingUrl || carrierOfficialUrl(code, invoice)
  };
}
