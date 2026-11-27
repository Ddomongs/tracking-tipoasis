export type TrackingType = "HBL" | "DOMESTIC" | "CARGO" | "UNKNOWN";

export type StatusCode = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DELIVERY_CARRIER_CODES = ["AUTO", "CJ", "EPOST", "HANJIN", "LOTTE", "LOGEN"] as const;

export type DeliveryCarrierCode = (typeof DELIVERY_CARRIER_CODES)[number];

export interface TrackingEvent {
  status: string;
  statusCode: StatusCode;
  datetime: string;
  location?: string;
  detail?: string;
  driverName?: string;
  driverPhone?: string;
  /** Server-internal: the UNI-PASS item name (prnm) of a summary row; the normalizer moves it to data.productName. */
  productName?: string;
}

/** Same-batch progress: cargo sampled from this shipment's master BL (same ship, same arrival), counts only. */
export interface CustomsBatchProgress {
  sampled: number;
  cleared: number;
  clearedToday: number;
}

/** UNI-PASS summary-row facts about the cargo itself (not events). Server-side input to the normalizer. */
export interface CustomsCargoInfo {
  cargMtNo?: string;
  /** UNI-PASS 입항일자 (etprDt), 'YYYY-MM-DD'. */
  arrivalDate?: string;
  /** True for a sea port (인천항), false for an airport, undefined when unknown. */
  bySea?: boolean;
  productName?: string;
  batch?: CustomsBatchProgress;
}

export interface CustomsResult {
  events: TrackingEvent[];
  estimateAdjusted?: boolean;
  /** The official arrival day (입항일), KST midnight ISO. */
  arrivalDate?: string;
  batch?: CustomsBatchProgress;
}

export interface DeliveryResult {
  carrier: string;
  carrierCode: DeliveryCarrierCode;
  invoiceNumber: string;
  trackingUrl?: string;
  lookupUnavailable?: boolean;
  ambiguous?: boolean;
  events: TrackingEvent[];
}

export interface DeliveryLookupResult {
  carrier: string;
  carrierCode: DeliveryCarrierCode;
  trackingUrl?: string;
  lookupUnavailable?: boolean;
  ambiguous?: boolean;
  events: TrackingEvent[];
}

export interface TimelineStep {
  step: StatusCode;
  label: string;
  completed: boolean;
  datetime?: string;
}

export interface TrackResponseData {
  trackingNumber: string;
  type: TrackingType;
  currentStatus: string;
  currentStatusCode: StatusCode;
  isPending?: boolean;
  estimatedCustomsClearanceDate?: string;
  /** The late end of the clearance window ('늦으면'); absent when only one date is known. */
  estimatedCustomsClearanceLatest?: string;
  /** The UNI-PASS item name (품명), when customs knows it (10월 2일 요청). Never stored. */
  productName?: string;
  estimatedDeliveryDate?: string;
  /** True when the shipment has had no new event for weeks, so estimates are withheld. */
  estimateStale?: boolean;
  customs: CustomsResult;
  delivery: DeliveryResult;
  timeline: TimelineStep[];
  lastUpdated: string;
}

export interface ApiError {
  code: "INVALID_NUMBER" | "API_TIMEOUT" | "NOT_FOUND" | "SERVER_ERROR" | "RATE_LIMITED";
  message: string;
}
