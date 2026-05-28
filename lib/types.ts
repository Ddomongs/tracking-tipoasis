export type TrackingType = "HBL" | "DOMESTIC" | "CARGO" | "UNKNOWN";

export type StatusCode = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface TrackingEvent {
  status: string;
  statusCode: StatusCode;
  datetime: string;
  location?: string;
  detail?: string;
  driverName?: string;
  driverPhone?: string;
}

export interface CustomsResult {
  events: TrackingEvent[];
}

export interface DeliveryResult {
  carrier: string;
  carrierCode: string;
  invoiceNumber: string;
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
  estimatedDeliveryDate?: string;
  customs: CustomsResult;
  delivery: DeliveryResult;
  timeline: TimelineStep[];
  lastUpdated: string;
}

export interface ApiError {
  code: "INVALID_NUMBER" | "API_TIMEOUT" | "NOT_FOUND" | "SERVER_ERROR" | "RATE_LIMITED";
  message: string;
}
