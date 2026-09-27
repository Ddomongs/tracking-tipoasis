"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAnnounce } from "@/components/primitives/LiveAnnouncer";
import type { LoadingConfig } from "@/lib/config/types";
import { classifyFailure } from "@/lib/tracking/classify-failure";
import { fetchTrack } from "@/lib/tracking/fetch-track";
import { deriveLoadingView, nextLoadingChangeMs } from "@/lib/tracking/loading-view";
import { INITIAL_LOOKUP_STATE, lastRequestOf, lookupReducer } from "@/lib/tracking/lookup-state";
import type { LookupEvent, LookupState } from "@/lib/tracking/lookup-state";
import type { LoadingViewModel, LookupOutcome, LookupRequest } from "@/lib/tracking/types";

// Client hook (contract §11.9; S06 may change internals only). Initial bundle: no zod, no derive code (module-boundary test).

export interface UseLookupOptions {
  readonly config: LoadingConfig;
  readonly onSettled?: (outcome: LookupOutcome, now: Date) => void; // called once per settled request, outside render
}

export interface UseLookupResult {
  readonly state: LookupState;
  readonly loading: LoadingViewModel | null; // recomputed only at stage boundaries and elapsed steps
  readonly submit: (request: LookupRequest) => void; // aborts the previous request
  readonly retry: () => void; // re-submits the last request with entry "retry"
  readonly cancel: () => void; // back to idle, number kept
  readonly reset: () => void;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const readReducedMotion = (): boolean => window.matchMedia(REDUCED_MOTION_QUERY).matches;
const serverReducedMotion = (): boolean => false;

export function useLookup({ config, onSettled }: UseLookupOptions): UseLookupResult {
  const [state, setState] = useState<LookupState>(INITIAL_LOOKUP_STATE);
  const [loading, setLoading] = useState<LoadingViewModel | null>(null);
  const stateRef = useRef<LookupState>(INITIAL_LOOKUP_STATE);
  const onSettledRef = useRef(onSettled);
  const announce = useAnnounce();
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverReducedMotion);

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  /** Applies one event and returns the next state at once, so a settled outcome (with its failure streak) is known right here. */
  const apply = useCallback((event: LookupEvent): LookupState => {
    const next = lookupReducer(stateRef.current, event);
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  const loadingAt = useCallback(
    (request: LookupRequest, startedAt: number): LoadingViewModel =>
      deriveLoadingView({ request, elapsedMs: performance.now() - startedAt, reducedMotion, now: new Date() }, config),
    [config, reducedMotion]
  );

  const submit = useCallback(
    (request: LookupRequest): void => {
      const startedAt = performance.now();
      apply({ type: "submit", request, at: startedAt });
      setLoading(loadingAt(request, startedAt));
    },
    [apply, loadingAt]
  );

  const retry = useCallback((): void => {
    const last = lastRequestOf(stateRef.current);
    if (last !== null) submit({ ...last, entry: "retry" });
  }, [submit]);

  const cancel = useCallback((): void => {
    setLoading(null);
    apply({ type: "cancelled" });
  }, [apply]);

  const reset = useCallback((): void => {
    setLoading(null);
    apply({ type: "reset" });
  }, [apply]);

  // One request per loading state: a newer submit, a cancel, a reset or unmount aborts it (spec §5, AbortController per submit).
  useEffect(() => {
    if (state.phase !== "loading") return undefined;
    const { request } = state;
    const controller = new AbortController();
    void fetchTrack(request, { signal: controller.signal, timeoutMs: config.lookup.timeoutMs }).then((result) => {
      if (controller.signal.aborted || result.kind === "aborted") return;
      const now = new Date();
      const at = performance.now();
      setLoading(null);
      const next =
        result.kind === "success"
          ? apply({ type: "succeeded", data: result.data, at })
          : apply({ type: "failed", cause: classifyFailure(result.input), at });
      if (next.phase === "settled" || next.phase === "error") onSettledRef.current?.(next.outcome, now);
    });
    return () => controller.abort();
  }, [apply, config.lookup.timeoutMs, state]);

  // One timer to the next visible change (0.4 s, 3 s, 5 s, 8 s, then every elapsedStepSeconds), never a ticking loop.
  // Each timer schedules the next one itself (not through a re-render), so the chain keeps pace with the clock even
  // when several steps pass before React renders (a background tab, or a paused test clock advanced in one jump).
  useEffect(() => {
    if (state.phase !== "loading") return undefined;
    const { request, startedAt } = state;
    let timer = 0;
    let shownStage: LoadingViewModel["stage"] | null = null;
    const scheduleNext = (): void => {
      const elapsed = performance.now() - startedAt;
      const delay = Math.max(0, nextLoadingChangeMs(elapsed, config) - elapsed);
      timer = window.setTimeout(() => {
        const next = loadingAt(request, startedAt);
        setLoading(next);
        if (next.stage !== shownStage && next.announcement !== null) announce(next.announcement);
        shownStage = next.stage;
        scheduleNext();
      }, delay);
    };
    shownStage = loadingAt(request, startedAt).stage;
    scheduleNext();
    return () => window.clearTimeout(timer);
  }, [announce, config, loadingAt, state]);

  // Offline: one automatic re-lookup when the connection returns (spec §5), never a second one in a row.
  useEffect(() => {
    if (state.phase !== "error" || state.outcome.cause !== "offline" || state.outcome.request.entry === "autoRetryOnline") {
      return undefined;
    }
    const request = state.outcome.request;
    const onOnline = (): void => submit({ ...request, entry: "autoRetryOnline" });
    window.addEventListener("online", onOnline, { once: true });
    return () => window.removeEventListener("online", onOnline);
  }, [state, submit]);

  return { state, loading, submit, retry, cancel, reset };
}
