import type { ResultCopyConfig } from "@/lib/config/types";

/** Slots each resultCopy field must contain — no more, no fewer. */
export const RESULT_COPY_SLOTS = {
  etaLabel: [], etaTodayLabel: [], etaOverdueLabel: [], etaDeliveredLabel: [],
  etaPendingText: [], etaWithheldText: [], etaUnknownText: [],
  customsEstimateCaption: ["date"], customsDoneCaption: ["date"],
  overdueChip: [], overdueSentence: [],
  carrierUnknown: [], carrierUnassigned: [],
  issueStopped: [], issueCut: [], issueBranch: [],
  stationDeparted: [], stationCustoms: [], stationDomestic: [], stationArrived: [],
  historySummary: ["n"], historyLast: ["time"], historyEmpty: [],
  actionFixNumber: [], actionRetry: [], actionCarrierOfficial: ["carrier"], actionCarrierLive: ["carrier"],
  actionCallDriver: [], actionReturnLink: [], actionUndelivered: [],
  pendingStoresIntro: [], notFoundCaveat: [], carrierCutLine: [], rateLimitedReason: ["seconds"],
  customsCheckNote: [], chooseCarrierSentence: []
} satisfies Readonly<Record<keyof ResultCopyConfig, readonly string[]>>;
