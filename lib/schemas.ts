import { z } from "zod";
import { DeliveryCarrierCodeSchema } from "@/lib/delivery-carriers";

export const TrackRequestSchema = z.object({
  trackingNumber: z.string().min(1, "조회번호를 입력해주세요").max(30, "번호가 너무 깁니다").trim(),
  carrierCode: DeliveryCarrierCodeSchema.default("AUTO")
});

export type TrackRequest = z.infer<typeof TrackRequestSchema>;

const StatusCodeSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7)
]);

export const TrackingEventSchema = z.object({
  status: z.string(),
  statusCode: StatusCodeSchema,
  datetime: z.string().datetime({ offset: true }),
  location: z.string().optional(),
  detail: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional()
});

export const TrackResponseDataSchema = z.object({
  trackingNumber: z.string(),
  type: z.enum(["HBL", "DOMESTIC", "CARGO", "UNKNOWN"]),
  currentStatus: z.string(),
  currentStatusCode: StatusCodeSchema,
  isPending: z.boolean().optional(),
  estimatedCustomsClearanceDate: z.string().datetime({ offset: true }).optional(),
  estimatedDeliveryDate: z.string().optional(),
  estimateStale: z.boolean().optional(),
  customs: z.object({
    events: z.array(TrackingEventSchema),
    estimateAdjusted: z.boolean().optional()
  }),
  delivery: z.object({
    carrier: z.string(),
    carrierCode: DeliveryCarrierCodeSchema,
    invoiceNumber: z.string(),
    trackingUrl: z.string().url().optional(),
    lookupUnavailable: z.boolean().optional(),
    ambiguous: z.boolean().optional(),
    events: z.array(TrackingEventSchema)
  }),
  timeline: z.array(
    z.object({
      step: StatusCodeSchema,
      label: z.string(),
      completed: z.boolean(),
      datetime: z.string().optional()
    })
  ),
  lastUpdated: z.string()
});

export const ApiTrackResponseSchema = z.discriminatedUnion("success", [
  z.object({ success: z.literal(true), data: TrackResponseDataSchema }),
  z.object({
    success: z.literal(false),
    error: z.object({ code: z.string(), message: z.string() })
  })
]);
