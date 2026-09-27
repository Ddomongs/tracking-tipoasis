"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { lookup as lookupConfig, notices, stateGuide } from "@/config/site.config";
import { FailureFallback } from "@/components/lookup/FailureFallback";
import { InputAssist } from "@/components/lookup/InputAssist";
import { getLoadedLegacyDeriver, LegacyRecommendations, LegacyResultSection, loadLegacyDeriver, type LegacyDeriver } from "@/components/lookup/LegacyResultSection";
import { LookupForm } from "@/components/lookup/LookupForm";
import { computeDisplay, outcomeKey, stillActiveHomeNotice, viewModeOf, type DerivedView, type InvalidInput, type LookupDisplay } from "@/components/lookup/lookup-display";
import { PendingCard } from "@/components/lookup/PendingCard";
import { ShortcutRow } from "@/components/lookup/ShortcutRow";
import { HOME_RESET_EVENT, getClientNowSnapshot, getRestoreSnapshot, getServerNowSnapshot, getServerRestoreSnapshot, isLookupHistoryEntry, markRestoreConsumed, pushLookupHistoryEntry, subscribeToNothing } from "@/components/lookup/session";
import { useLookup } from "@/components/lookup/useLookup";
import { Button } from "@/components/primitives/Button";
import { useAnnounce } from "@/components/primitives/LiveAnnouncer";
import { NumberBar } from "@/components/primitives/NumberBar";
import { NoticeBanner } from "@/components/primitives/NoticeBanner";
import { setAdSignals } from "@/lib/ads/ad-signals";
import type { LoadingConfig } from "@/lib/config/types";
import type { LookupState } from "@/lib/tracking/lookup-state";
import { saveRestoreEntry, type RestoreEntry } from "@/lib/privacy/session-restore";
import { SCRUB_TIMEOUT_MS, scrubNumberFromUrl } from "@/lib/privacy/url-scrub";
import { CARRIER_NAMES, requestCarrierView } from "@/lib/tracking/carriers";
import { groupTrackingNumber } from "@/lib/tracking/number-format";
import { detectConfusables, extractFromPastedText, normalizeInput, pasteCarrierNotice, precheckNumber } from "@/lib/tracking/number-input";
import type {
  LookupEntry,
  LookupOutcome,
  LookupRequest,
  NoticeView,
  NumberView,
  ResultAction,
  TrackingEntry,
  TrackingViewModel
} from "@/lib/tracking/types";
import type { DeliveryCarrierCode } from "@/lib/types";

export interface LookupControllerProps {
  readonly entry: TrackingEntry;
  readonly homeNotice: NoticeView | null; // server-picked; re-filtered with KST after mount (Task 8)
  readonly idleExtras: React.ReactNode;   // server-rendered below-the-fold blocks, rendered only in idle mode
}

const LOADING_CONFIG: LoadingConfig = { lookup: lookupConfig, notices };
const HEADING_ID = "lookup-heading";
const HOME_HEADING = "통관부터 국내 배송까지 한 번에 확인";
const RESULT_HEADING = "배송 조회 결과";
const CHANGE_NUMBER_LABEL = "번호 변경";
const LOOKUP_ANOTHER_LABEL = "다른 번호 조회";
const TITLE_SUFFIX = " · 배송 조회";
/** The root layout's metadata title; restored when the customer is back on the form. */
const HOME_DOCUMENT_TITLE = "통관·국내 배송 한 번에 조회";
const LOADING_DOCUMENT_TITLE = `${stateGuide.loading.docTitle}${TITLE_SUFFIX}`;
const INVALID_DOCUMENT_TITLE = `${stateGuide.invalidNumber.docTitle}${TITLE_SUFFIX}`;
/** Deep links and restores move focus only if the customer has not interacted (spec §5). */
const PASSIVE_ENTRIES: ReadonlySet<LookupEntry> = new Set<LookupEntry>(["deepLink", "restore"]);
const INTERACTION_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/** The last settled screen, replayed by Forward without a new lookup. */
interface ReplayFrame {
  readonly state: Extract<LookupState, { readonly phase: "settled" | "error" }>;
  readonly derived: DerivedView;
}

/** True when the customer already scrolled or moved focus before the listeners below were attached. */
function interactedBeforeHydration(): boolean {
  return window.scrollY > 0 || (document.activeElement !== null && document.activeElement !== document.body);
}

/**
 * The browser records the first press or tap even before hydration and reports it a moment later (buffered);
 * the listeners attached after hydration would miss it. Returns the cleanup, or null where the entry type is unknown.
 */
function watchFirstInput(onInput: () => void): (() => void) | null {
  if (typeof PerformanceObserver === "undefined" || !PerformanceObserver.supportedEntryTypes.includes("first-input")) return null;
  const observer = new PerformanceObserver(onInput);
  observer.observe({ type: "first-input", buffered: true });
  return () => observer.disconnect();
}

/** Title writes live outside the component: the React Compiler treats `document` as an outer value it must not mutate in render scope. */
function setDocumentTitle(title: string): void {
  document.title = title;
}

function initialInvalid(entry: TrackingEntry): InvalidInput | null {
  if (entry.kind !== "invalidDeepLink") return null;
  const result = precheckNumber(entry.input);
  return { diagnosis: result.ok ? null : result.diagnosis, attempt: 0 };
}

/** The lookup a document starts on its own: a deep link, or a restored lookup on '/'. */
function autoRequest(entry: TrackingEntry, restore: RestoreEntry | null): LookupRequest | null {
  if (entry.kind === "deepLink") return { number: entry.number, carrier: entry.carrier, entry: "deepLink" };
  if (entry.kind === "home" && restore !== null) return { number: restore.number, carrier: restore.carrier, entry: "restore" };
  return null;
}

function numberViewOf(number: string): NumberView {
  return { raw: number, grouped: groupTrackingNumber(number) };
}

function deriveSafely(derive: LegacyDeriver, outcome: LookupOutcome, now: Date): TrackingViewModel | null {
  try {
    return derive(outcome, now);
  } catch {
    return null;
  }
}

function pageTitleOf(display: LookupDisplay, loadingLike: boolean): string | null {
  if (display.kind === "form") {
    if (display.invalid !== null) return INVALID_DOCUMENT_TITLE;
    return display.busy ? LOADING_DOCUMENT_TITLE : HOME_DOCUMENT_TITLE;
  }
  return loadingLike ? LOADING_DOCUMENT_TITLE : null; // settled titles come from the view model
}

/**
 * The one client island of the tracking page (spec §3, §14): mode as component state, lookups through S04's useLookup,
 * candidate B and restore (S02), focus/live/title rules (spec §5). [다른 번호 조회] is a state reset, never a navigation.
 */
export function LookupController({ entry, homeNotice, idleExtras }: LookupControllerProps): React.JSX.Element {
  const announce = useAnnounce();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const autoStartedRef = useRef(false);
  const focusInputRef = useRef(false);
  const interactedRef = useRef(false);
  const derivedSeqRef = useRef(0);
  const handledSeqRef = useRef<number | null>(null);
  const manualPendingRef = useRef(false);
  const lastShownRef = useRef<ReplayFrame | null>(null);

  const [inputValue, setInputValue] = useState(() =>
    entry.kind === "deepLink" ? entry.number : entry.kind === "invalidDeepLink" ? entry.input : ""
  );
  const [carrier, setCarrier] = useState<DeliveryCarrierCode>(() => (entry.kind === "deepLink" ? entry.carrier : "AUTO"));
  const [formOpen, setFormOpen] = useState(entry.kind !== "deepLink");
  const [localInvalid, setLocalInvalid] = useState<InvalidInput | null>(() => initialInvalid(entry));
  const [derived, setDerived] = useState<DerivedView | null>(null);
  const [pasted, setPasted] = useState<{ readonly carrierName: string; readonly previous: DeliveryCarrierCode } | null>(null);
  const [replay, setReplay] = useState<ReplayFrame | null>(null);

  // Overdue and every date are judged with the client clock at settle time (spec §6), never during render.
  const handleSettled = useCallback((outcome: LookupOutcome, now: Date) => {
    derivedSeqRef.current += 1;
    const seq = derivedSeqRef.current;
    const key = outcomeKey(outcome);
    const loaded = getLoadedLegacyDeriver();
    if (loaded !== null) {
      setDerived({ key, seq, view: deriveSafely(loaded, outcome, now) });
      return;
    }
    void loadLegacyDeriver().then(
      (derive) => setDerived({ key, seq, view: deriveSafely(derive, outcome, now) }),
      () => setDerived({ key, seq, view: null })
    );
  }, []);

  const { state, loading, submit, retry, cancel, reset } = useLookup({ config: LOADING_CONFIG, onSettled: handleSettled });
  const restoreEntry = useSyncExternalStore(subscribeToNothing, getRestoreSnapshot, getServerRestoreSnapshot);
  const clientNowMs = useSyncExternalStore(subscribeToNothing, getClientNowSnapshot, getServerNowSnapshot);
  const notice = stillActiveHomeNotice(homeNotice, notices, clientNowMs);

  const replaying = replay !== null && state.phase === "idle";
  const shownState: LookupState = replaying ? replay.state : state;
  const display = computeDisplay({ state: shownState, loading, entry, formOpen, localInvalid, derived: replaying ? replay.derived : derived });
  const viewMode = viewModeOf(display, state.phase);
  const activeRequest = display.kind === "form" ? null : display.request;
  const loadingLike = display.kind === "pending" || state.phase === "loading";

  const beginLookup = useCallback(
    (request: LookupRequest) => {
      markRestoreConsumed();
      manualPendingRef.current = request.entry === "manual";
      // Every lookup start overwrites the tab's one restore entry; a deep link stashes it in the scrub instead (S02).
      if (request.entry !== "deepLink") saveRestoreEntry({ number: request.number, carrier: request.carrier, savedAt: Date.now() });
      void loadLegacyDeriver().catch(() => undefined);
      submit(request);
    },
    [submit]
  );

  // Candidate B ②: the lookup starts right after hydration (deep link), or a reload/back_forward restores it.
  useEffect(() => {
    if (autoStartedRef.current) return;
    const request = autoRequest(entry, restoreEntry);
    if (request === null) return;
    autoStartedRef.current = true;
    beginLookup(request);
  }, [beginLookup, entry, restoreEntry]);

  // Candidate B ③–⑥ (S02): wait for the router, stash, replaceState('/'), confirm, then tell the ad gate.
  useEffect(() => {
    if (entry.kind === "home") return;
    const stash = entry.kind === "deepLink" ? { number: entry.number, carrier: entry.carrier } : null;
    void scrubNumberFromUrl({
      timeoutMs: SCRUB_TIMEOUT_MS,
      beforeReplace: () => {
        if (stash !== null) saveRestoreEntry({ ...stash, savedAt: Date.now() });
      }
    }).then((status) => {
      // An INVALID deep link never unlocks the ad loader (spec §7 INVALID: 광고 0, 로더가 없으면 넣지 않음).
      if (stash === null) return;
      if (status === "scrubbed" || status === "failed") setAdSignals({ scrub: status });
    });
  }, [entry]);

  useEffect(() => {
    const mark = (): void => {
      interactedRef.current = true;
    };
    // Input that arrived before hydration (a slow deep link) is not seen by these listeners (S04 deferred minor).
    if (interactedBeforeHydration()) mark();
    const stopWatching = watchFirstInput(mark);
    for (const type of INTERACTION_EVENTS) document.addEventListener(type, mark, { capture: true, passive: true });
    return () => {
      stopWatching?.();
      for (const type of INTERACTION_EVENTS) document.removeEventListener(type, mark, { capture: true });
    };
  }, []);

  // The header's site-name link on '/' (HomeLink): back to an empty lookup form.
  useEffect(() => {
    const onHome = (): void => {
      setReplay(null);
      setPasted(null);
      reset();
      setInputValue("");
      setCarrier("AUTO");
      setLocalInvalid(null);
      setFormOpen(true);
    };
    window.addEventListener(HOME_RESET_EVENT, onHome);
    return () => window.removeEventListener(HOME_RESET_EVENT, onHome);
  }, [reset]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent): void => {
      if (window.location.pathname !== "/") return;
      if (isLookupHistoryEntry(event.state)) {
        setReplay(lastShownRef.current);
        return;
      }
      const last = lastShownRef.current;
      setReplay(null);
      reset();
      if (last !== null) {
        setInputValue(last.state.outcome.request.number);
        setCarrier(last.state.outcome.request.carrier);
      }
      setLocalInvalid(null);
      setFormOpen(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [reset]);

  // A settled lookup: the document title, one live sentence for a result, and focus to the visible status h2 (spec §5).
  // Errors are read through their own role="alert" sentence, so only results are announced (as S04's HomePageClient did).
  // The loading sentences ('조회를 시작했어요', the 8 s sentence) are announced by S04's useLookup at its stage changes.
  const settled = display.kind === "slot" && display.derived !== null ? display.derived : null;
  const settledEntry = activeRequest?.entry ?? null;
  useEffect(() => {
    if (settled === null || handledSeqRef.current === settled.seq) return;
    handledSeqRef.current = settled.seq;
    if (!replaying && (state.phase === "settled" || state.phase === "error")) lastShownRef.current = { state, derived: settled };
    if (manualPendingRef.current) {
      manualPendingRef.current = false;
      pushLookupHistoryEntry();
    }
    if (settled.view !== null) {
      setDocumentTitle(settled.view.documentTitle);
      if (settled.view.mode === "settled") announce(settled.view.liveMessage);
    }
    if (settledEntry !== null && PASSIVE_ENTRIES.has(settledEntry) && interactedRef.current) return;
    headingRef.current?.focus();
  }, [announce, replaying, settled, settledEntry, state]);

  const pageTitle = pageTitleOf(display, loadingLike);
  useEffect(() => {
    if (pageTitle !== null) setDocumentTitle(pageTitle);
  }, [pageTitle]);

  // A server INVALID answer (400/413/415) is shown at the input and keeps the focus there (spec §5).
  const serverInvalidAt = state.phase === "error" && state.outcome.cause === "invalidNumber" ? state.settledAt : null;
  useEffect(() => {
    if (serverInvalidAt !== null) inputRef.current?.focus();
  }, [serverInvalidAt]);

  // After [번호 변경] / [다른 번호 조회] / [번호 수정] the form is back: focus and select the number (WCAG 3.3.7 keeps it).
  useEffect(() => {
    if (display.kind !== "form" || !focusInputRef.current) return;
    focusInputRef.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  });

  const openForm = useCallback(
    (how: "cancel" | "reset", request: LookupRequest | null) => {
      setPasted(null);
      setReplay(null);
      if (how === "cancel") cancel();
      else reset();
      if (request !== null) {
        setInputValue(request.number);
        setCarrier(request.carrier);
      }
      setLocalInvalid(null);
      setFormOpen(true);
      focusInputRef.current = true;
    },
    [cancel, reset, setCarrier, setFormOpen, setInputValue, setLocalInvalid, setPasted, setReplay]
  );

  const handleSubmit = useCallback(() => {
    setPasted(null);
    setReplay(null);
    const result = precheckNumber(inputValue);
    if (!result.ok) {
      if (state.phase === "loading") cancel(); // a new submission always replaces the running one (spec §5)
      setLocalInvalid((previous) => ({ diagnosis: result.diagnosis, attempt: (previous?.attempt ?? 0) + 1 }));
      inputRef.current?.focus();
      return;
    }
    setLocalInvalid(null);
    beginLookup({ number: result.number, carrier, entry: "manual" });
  }, [beginLookup, cancel, carrier, inputValue, setLocalInvalid, setPasted, setReplay, state.phase]);

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      const text = event.clipboardData.getData("text");
      if (text === "" || precheckNumber(text).ok) return; // a bare number: the browser pastes it
      const extraction = extractFromPastedText(text);
      if (extraction === null) return; // zero or several candidates: the customer edits the text (Review Focus 1)
      event.preventDefault();
      setInputValue(extraction.number);
      setLocalInvalid(null);
      if (extraction.carrier === null || extraction.carrier === carrier) {
        setPasted(null);
        return;
      }
      const carrierName = CARRIER_NAMES[extraction.carrier];
      setPasted({ carrierName, previous: carrier });
      setCarrier(extraction.carrier);
      announce(pasteCarrierNotice(carrierName));
    },
    [announce, carrier, setCarrier, setInputValue, setLocalInvalid, setPasted]
  );

  const handleUndoPaste = useCallback(() => {
    if (pasted !== null) setCarrier(pasted.previous);
    setPasted(null);
    inputRef.current?.focus(); // the [되돌리기] button disappears; keep the keyboard in the form
  }, [pasted, setCarrier, setPasted]);

  const handleCarrierChange = useCallback((next: DeliveryCarrierCode) => {
    setCarrier(next);
    setPasted(null);
  }, [setCarrier, setPasted]);

  const handleAction = useCallback(
    (action: ResultAction) => {
      switch (action.kind) {
        case "fixNumber":
          openForm("reset", activeRequest);
          return;
        case "cancel":
          openForm("cancel", activeRequest);
          return;
        case "retry":
          // A screen replayed by Forward: useLookup was reset on Back, so it has no request to retry (S06 review).
          if (replaying) {
            setReplay(null);
            beginLookup({ ...replay.state.outcome.request, entry: "retry" });
            return;
          }
          retry();
          return;
        case "chooseCarrier":
          if (activeRequest === null) return;
          setCarrier(action.carrier);
          beginLookup({ number: activeRequest.number, carrier: action.carrier, entry: "carrierChip" });
          return;
        case "copied":
        case "openedExternal":
          return;
      }
    },
    [activeRequest, beginLookup, openForm, replay, replaying, retry, setCarrier, setReplay]
  );

  // The question is asked before submitting; once the pre-check error shows, the diagnosis carries it instead.
  const confusable = display.kind === "form" && display.invalid === null ? detectConfusables(normalizeInput(inputValue)) : null;
  const numberBarAction =
    activeRequest === null ? null : (
      <Button variant="text" onClick={() => openForm(loadingLike ? "cancel" : "reset", activeRequest)}>
        {loadingLike ? CHANGE_NUMBER_LABEL : LOOKUP_ANOTHER_LABEL}
      </Button>
    );
  const carrierLabel =
    settled?.view?.carrier.barLabel ??
    (activeRequest === null ? "" : requestCarrierView(activeRequest, lookupConfig.copy.carrierAuto).barLabel);

  return (
    <>
      {viewMode === "idle" && notice !== null ? <NoticeBanner notice={notice} variant="banner" /> : null}
      <div id="tracking-panel">
        <section
          id="tracking"
          aria-labelledby={HEADING_ID}
          data-view-state={viewMode}
          data-ad-exclude="true"
          className="flex flex-col gap-4 pb-6"
        >
          <h1
            id={HEADING_ID}
            className={
              display.kind === "form"
                ? "m-0 px-[var(--tt-gutter)] pt-2 text-tt-xl font-black text-tt-ink [word-break:keep-all]"
                : "sr-only"
            }
          >
            {display.kind === "form" ? HOME_HEADING : RESULT_HEADING}
          </h1>
          {display.kind === "form" ? (
            <LookupForm
              value={inputValue}
              carrier={carrier}
              busy={display.busy}
              invalid={
                display.invalid === null
                  ? null
                  : { message: stateGuide.invalidNumber.title, diagnosis: display.invalid.diagnosis, attempt: display.invalid.attempt }
              }
              inputRef={inputRef}
              onValueChange={setInputValue}
              onCarrierChange={handleCarrierChange}
              onSubmit={handleSubmit}
              assist={<InputAssist confusable={confusable} pastedCarrierName={pasted?.carrierName ?? null} onUndo={handleUndoPaste} />}
              assistVisible={confusable !== null || pasted !== null}
              onPaste={handlePaste}
            />
          ) : (
            <NumberBar number={numberViewOf(display.request.number)} carrierLabel={carrierLabel} actions={numberBarAction} />
          )}
          {display.kind === "form" && !display.busy ? <ShortcutRow mode={display.invalid === null ? "full" : "talkOnly"} /> : null}
          {display.kind === "form" ? null : (
            <div aria-busy={loadingLike || undefined} className={loadingLike ? "min-h-[560px]" : undefined}>
              {display.kind === "pending" ? <PendingCard title={lookupConfig.copy.title} body={lookupConfig.copy.body} /> : null}
              {display.kind === "slot" && settled !== null && settled.view === null ? (
                <div className="flex flex-col gap-3 pt-2">
                  <h2 ref={headingRef} tabIndex={-1} className="m-0 px-[var(--tt-gutter)] text-tt-lg font-black text-tt-ink outline-none">
                    {stateGuide.serverError.title}
                  </h2>
                  <FailureFallback guideKey="serverError" />
                </div>
              ) : null}
              {display.kind === "slot" && (settled === null || settled.view !== null) ? (
                <LegacyResultSection
                  state={shownState}
                  loading={loading}
                  view={settled?.view ?? null}
                  onAction={handleAction}
                  headingRef={headingRef}
                />
              ) : null}
            </div>
          )}
        </section>
      </div>
      {display.kind === "slot" && settled !== null && settled.view !== null ? (
        <LegacyRecommendations state={shownState} view={settled.view} />
      ) : null}
      {viewMode === "idle" ? idleExtras : null}
    </>
  );
}
