"use client";

import { useCallback, useSyncExternalStore } from "react";
import { AD_TIMING_POLICY, adGateState, type AdGateState } from "@/lib/ads/ad-gate";
import { getAdSignals, subscribeAdSignals } from "@/lib/ads/ad-signals";

function readGate(): AdGateState {
  return adGateState({ ...getAdSignals(), pathname: window.location.pathname, policy: AD_TIMING_POLICY });
}

/**
 * The ad gate of this document, re-read on every ad-signal change (scrub result, allowed result, scroll). The server has
 * no signals: a home render ('/' is static) is judged as a fresh home document, anything else as closed.
 */
export function useAdGateState(serverEntry: "home" | "deepLink" | null): AdGateState {
  const readServerGate = useCallback((): AdGateState => {
    if (serverEntry !== "home") return "closed";
    return adGateState({
      pathname: "/",
      entry: "home",
      scrub: "pending",
      resultAdsAllowed: null,
      scrolledPastLookup: false,
      policy: AD_TIMING_POLICY
    });
  }, [serverEntry]);
  return useSyncExternalStore(subscribeAdSignals, readGate, readServerGate);
}
