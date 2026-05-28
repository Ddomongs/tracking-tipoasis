import type { TrackingType } from "@/lib/types";

export interface IdentifyResult {
  type: TrackingType;
  number: string;
}

export const identifyTrackingNumber = (input: string): IdentifyResult => {
  const cleaned = input.replace(/[\s-]/g, "");

  if (/^[A-Z]{3,4}\d{8,16}$/i.test(cleaned)) {
    return { type: "HBL", number: cleaned };
  }

  if (/^\d{10,14}$/.test(cleaned)) {
    return { type: "DOMESTIC", number: cleaned };
  }

  if (/^\d{15,}$/.test(cleaned)) {
    return { type: "CARGO", number: cleaned };
  }

  return { type: "UNKNOWN", number: cleaned };
};
