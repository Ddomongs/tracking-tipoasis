"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useAnnounce } from "@/components/primitives/LiveAnnouncer";
import { TalkLink } from "@/components/primitives/TalkLink";
import { channels } from "@/config/site.config";
import type { LoadingConfig } from "@/lib/config/types";
import { deriveLoadingView } from "@/lib/tracking/loading-view";
import type { LookupState } from "@/lib/tracking/lookup-state";
import type {
  LoadingViewModel,
  LookupEntry,
  LookupOutcome,
  ResultAction,
  TrackingEntry,
  TrackingViewModel
} from "@/lib/tracking/types";
import { interactedBeforeHydration, watchFirstInput } from "./early-interaction";
import { LoadingCard, type LoadingPromo } from "./LoadingCard";
import { loadResultModule, preloadResultModule, type ResultModule } from "./load-result-module";

export interface ResultSlotProps {
  readonly entry: TrackingEntry;
  readonly loadingConfig: LoadingConfig;
  readonly state: LookupState;
  readonly loading: LoadingViewModel | null;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef?: React.RefObject<HTMLHeadingElement | null>;
  /** Called once per settled view, after it is on screen (ad signals, the number bar's carrier label, S08 extras). */
  readonly onView?: (view: TrackingViewModel) => void;
  readonly renderRecommendations?: (view: TrackingViewModel, outcome: LookupOutcome) => React.ReactNode;
  /** The 톡톡 invitation shown in the loading card (10월 2일 요청); null keeps the plain skeleton. */
  readonly loadingPromo?: LoadingPromo | null;
}

type SettledState = Extract<LookupState, { readonly phase: "settled" | "error" }>;

interface Shown {
  readonly state: SettledState;
  readonly view: TrackingViewModel;
  readonly module: ResultModule;
}

/** The first-paint card of a deep link shows no notice, so it needs no clock; a constant keeps SSR and hydration equal. */
const FIRST_PAINT_NOW = new Date(0);
/** Lookups the customer did not start on this screen: focus moves only if they have not interacted meanwhile (spec §5). */
const QUIET_ENTRIES: ReadonlySet<LookupEntry> = new Set<LookupEntry>(["deepLink", "restore", "autoRetryOnline"]);
/** What counts as the customer interacting (the same four events S06's LookupController used): taps, keys, wheel and touch scrolls. */
const INTERACTION_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;


/**
 * Loads the result module and derives the settled view. A chunk that cannot load and a derive that throws both end as
 * `null` (the 톡톡 fallback), never as an endless placeholder (S07 review).
 */
export function settleView<M extends { deriveResultView: (outcome: LookupOutcome, now: Date) => TrackingViewModel }>(
  load: () => Promise<M>,
  outcome: LookupOutcome,
  now: Date
): Promise<{ readonly module: M; readonly view: TrackingViewModel } | null> {
  return load()
    .then((module) => ({ module, view: module.deriveResultView(outcome, now) }))
    .catch(() => null);
}
function isSettled(state: LookupState): state is SettledState {
  return state.phase === "settled" || state.phase === "error";
}

/** Invalid numbers are shown by the lookup form (S06, data-guide-key="invalidNumber"); the result slot stays empty. */
function isInvalid(state: LookupState): boolean {
  return state.phase === "error" && state.outcome.cause === "invalidNumber";
}

function firstPaintLoading(entry: TrackingEntry, state: LookupState, config: LoadingConfig): LoadingViewModel | null {
  if (entry.kind !== "deepLink" || state.phase !== "idle" || state.lastRequest !== null) return null;
  return deriveLoadingView(
    {
      request: { number: entry.number, carrier: entry.carrier, entry: "deepLink" },
      elapsedMs: 0,
      reducedMotion: false,
      now: FIRST_PAINT_NOW
    },
    { lookup: config.lookup, notices: [] }
  );
}

function visibleLoading(state: LookupState, loading: LoadingViewModel | null): LoadingViewModel | null {
  if (state.phase !== "loading" || loading === null) return null;
  // A manual lookup shows only the busy button label for the first 0.4 s (spec §5).
  return loading.stage === "instant" && state.request.entry === "manual" ? null : loading;
}

function focusHeading(heading: HTMLHeadingElement | null): void {
  if (heading === null) return;
  heading.focus({ preventScroll: true });
  const box = heading.getBoundingClientRect();
  if (box.bottom < 0 || box.top > window.innerHeight) heading.scrollIntoView({ block: "start" });
}

/** The result chunk could not load (a deploy replaced it, or the connection dropped): 톡톡 stays reachable. */
function ModuleFailure(): React.JSX.Element {
  return (
    <section
      data-cta-state="error"
      data-result-module-failure="true"
      className="flex min-h-[calc(100svh_-_6.5rem)] flex-col gap-3 bg-tt-surface px-[var(--tt-gutter)] py-4"
    >
      <TalkLink href={channels.talk.url} label={channels.talk.labels.cta} weight="primary" placement="state" />
    </section>
  );
}

/** Keeps the loading card's place for the moment between the settle and the lazy chunk (no jump, no shift). */
function PendingPlaceholder(): React.JSX.Element {
  return <div data-result-pending="true" aria-hidden="true" className="min-h-[calc(100svh_-_6.5rem)]" />;
}

/**
 * The result slot of the lookup screen (spec §5–§7): LoadingCard while a lookup runs (and on a deep link's first
 * paint), then the lazy ResultView for the settled or failed lookup. It owns what happens when a result arrives:
 * the document title (never the number), one live sentence, and the focus move to the status h2.
 */
export function ResultSlot({
  entry,
  loadingConfig,
  state,
  loading,
  onAction,
  headingRef,
  onView,
  renderRecommendations,
  loadingPromo = null
}: ResultSlotProps): React.JSX.Element | null {
  const [shown, setShown] = useState<Shown | null>(null);
  const [failed, setFailed] = useState<SettledState | null>(null);
  const localHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const initialTitleRef = useRef<string | null>(null);
  const interactedRef = useRef(false);
  const announce = useAnnounce();
  const targetRef = headingRef ?? localHeadingRef;

  // The page's own title comes back in idle and loading; interactions gate the deep-link focus move; focus entering the
  // lookup form is intent, so the result chunk downloads while the customer types (an offline error can still be drawn).
  useEffect(() => {
    initialTitleRef.current = document.title;
    const markInteraction = (): void => {
      interactedRef.current = true;
    };
    const preloadOnIntent = (event: FocusEvent): void => {
      if (event.target instanceof Element && event.target.closest("[data-lookup-form]") !== null) preloadResultModule();
    };
    // A key or tap before hydration (a slow deep link) still counts.
    if (interactedBeforeHydration()) markInteraction();
    const stopWatching = watchFirstInput(markInteraction);
    for (const type of INTERACTION_EVENTS) window.addEventListener(type, markInteraction, { capture: true, passive: true });
    document.addEventListener("focusin", preloadOnIntent);
    // Focus that reached the form before hydration (a slow page) never fired the listener above: preload now.
    if (document.activeElement?.closest("[data-lookup-form]")) preloadResultModule();
    return () => {
      stopWatching?.();
      for (const type of INTERACTION_EVENTS) window.removeEventListener(type, markInteraction, { capture: true });
      document.removeEventListener("focusin", preloadOnIntent);
    };
  }, []);

  useEffect(() => {
    if (state.phase === "loading" || entry.kind === "deepLink") preloadResultModule();
  }, [state.phase, entry.kind]);

  useEffect(() => {
    if (state.phase !== "idle" && state.phase !== "loading") return;
    if (initialTitleRef.current !== null) document.title = initialTitleRef.current;
  }, [state.phase]);

  // Derive when the lookup settles. `now` is read here, after the commit — never during render (spec §7 overdue).
  useEffect(() => {
    if (!isSettled(state) || isInvalid(state)) return undefined;
    let active = true;
    const now = new Date();
    void settleView(loadResultModule, state.outcome, now).then((settled) => {
      if (!active) return;
      if (settled === null) setFailed(state);
      else setShown({ state, view: settled.view, module: settled.module });
    });
    return () => {
      active = false;
    };
  }, [state]);

  const presentView = useEffectEvent((next: Shown): void => {
    document.title = next.view.documentTitle;
    announce(next.view.liveMessage);
    onView?.(next.view);
    const quiet = QUIET_ENTRIES.has(next.state.outcome.request.entry);
    if (!quiet || !interactedRef.current) focusHeading(targetRef.current);
    interactedRef.current = false;
  });

  useEffect(() => {
    if (shown !== null) presentView(shown);
  }, [shown]);

  if (isSettled(state)) {
    if (isInvalid(state)) return null;
    if (shown !== null && shown.state === state) {
      // The lazy component is a module singleton with a stable identity (the same function on every render).
      return (
        <shown.module.ResultView
          view={shown.view}
          onAction={onAction}
          headingRef={targetRef}
          failureCause={state.phase === "error" ? state.outcome.cause : undefined}
          recommendationSlot={renderRecommendations?.(shown.view, state.outcome)}
        />
      );
    }
    return failed === state ? <ModuleFailure /> : <PendingPlaceholder />;
  }
  const card = visibleLoading(state, loading) ?? firstPaintLoading(entry, state, loadingConfig);
  return card === null ? null : <LoadingCard loading={card} promo={loadingPromo} onCancel={() => onAction({ kind: "cancel" })} />;
}
