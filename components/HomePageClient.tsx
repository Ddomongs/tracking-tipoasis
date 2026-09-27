"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion, MotionConfig, useReducedMotion } from "framer-motion";
import { AssuranceRail } from "@/components/AssuranceRail";
import { CustomsTimeline } from "@/components/CustomsTimeline";
import { DeliveryTimeline } from "@/components/DeliveryTimeline";
import { LogisticsFlow } from "@/components/LogisticsFlow";
import { RecommendedProducts } from "@/components/RecommendedProducts";
import type { RecommendationStage } from "@/components/RecommendedProducts";
import { ServiceGuide } from "@/components/ServiceGuide";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StoreContactPopup } from "@/components/StoreContactPopup";
import { StorefrontShowcase } from "@/components/StorefrontShowcase";
import { TrackingForm } from "@/components/TrackingForm";
import { useLookup } from "@/components/lookup/useLookup";
import { LiveAnnouncerProvider, useAnnounce } from "@/components/primitives/LiveAnnouncer";
import { StatusSlot } from "@/components/status-slot/StatusSlot";
import { deriveStatusView } from "@/components/status-slot/status-view";
import { Card } from "@/components/ui/card";
import { lookup as lookupSettings, notices } from "@/config/site.config";
import { setAdSignals } from "@/lib/ads/ad-signals";
import type { LoadingConfig } from "@/lib/config/types";
import { currentNavigationKind, readRestoreEntry, saveRestoreEntry } from "@/lib/privacy/session-restore";
import type { RestoreEntry } from "@/lib/privacy/session-restore";
import { SCRUB_TIMEOUT_MS, scrubNumberFromUrl } from "@/lib/privacy/url-scrub";
import { INITIAL_LOOKUP_STATE } from "@/lib/tracking/lookup-state";
import type { LookupOutcome, LookupRequest, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import type { DeliveryCarrierCode, TrackResponseData } from "@/lib/types";

type HomePageClientProps = {
  initialTrackingNumber: string;
};

const LOADING_CONFIG: LoadingConfig = { lookup: lookupSettings, notices };

/** Transitional normalization of a typed number (S06's normalizeInput replaces it): half-width digits, no spaces or hyphens, uppercase. */
const toRequestNumber = (value: string): string =>
  value
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/[\s-]/g, "")
    .toUpperCase();

/** Inline recommendations only where the view places them (spec §8); the legacy list knows pending, in transit and delivered. */
const recommendationStageOf = (view: TrackingViewModel | null): RecommendationStage | null => {
  if (view === null || view.mode !== "settled" || view.revenue.recommendations !== "inline") return null;
  const context = view.revenue.recommendationContext;
  return context === "pending" || context === "inTransit" || context === "delivered" ? context : null;
};

// The legacy timelines stay below the slot as the details until S07 moves the history into the result view.

const getDeliveryWaitingMessage = (data: TrackResponseData): string | undefined => {
  if (data.delivery.events.length > 0) return undefined;

  if (data.delivery.ambiguous) {
    return "같은 번호가 여러 택배사에서 확인됐습니다. 위에서 택배사를 선택해 다시 조회해 주세요.";
  }

  if (data.delivery.lookupUnavailable) {
    return data.delivery.trackingUrl
      ? "택배사 조회가 지연되고 있습니다. 아래 링크에서 확인해 주세요."
      : "자동 조회가 지연되고 있습니다. 위에서 택배사를 선택해 다시 조회해 주세요.";
  }

  if (data.isPending) {
    return "상품이 아직 국내 도착 전이라 통관·배송 내역이 없습니다. 구매한 쇼핑몰을 선택하거나 톡톡으로 문의해 주세요.";
  }

  if (data.customs.events.length > 0 && data.currentStatusCode >= 4) {
    return "택배사 인계를 기다리고 있습니다. 보통 통관 완료 후 0~1영업일 내 인계됩니다.";
  }

  return undefined;
};

// Session restore (spec §3, S02): only in reload/back_forward documents, read once per document, and dropped as
// soon as any lookup starts in this document (so an in-app return to '/' does not replay it). The server
// snapshot is null, so the static '/' HTML and the first client render stay identical.
let restoreSnapshot: RestoreEntry | null | undefined;
let restoreConsumed = false;
const subscribeToNothing = (): (() => void) => () => undefined;
const getRestoreSnapshot = (): RestoreEntry | null => {
  if (restoreConsumed) return null;
  if (restoreSnapshot === undefined) {
    restoreSnapshot = readRestoreEntry({ now: Date.now(), navigation: currentNavigationKind() });
  }
  return restoreSnapshot;
};
const getServerRestoreSnapshot = (): RestoreEntry | null => null;
const markRestoreConsumed = (): void => {
  restoreConsumed = true;
};

// S02-HISTORY-ENTRY:BEGIN
// Same-address history entry (spec §3 뒤로가기, S02 Task 11): when a manual lookup settles on '/', push '/' once more so that
// Back returns to the lookup form instead of leaving the site.
const LOOKUP_HISTORY_MARK = "ttLookup";
const isLookupHistoryEntry = (state: unknown): boolean =>
  typeof state === "object" && state !== null && LOOKUP_HISTORY_MARK in state;
const pushLookupHistoryEntry = (): void => {
  const { pathname, search, hash } = window.location;
  if (pathname !== "/" || search !== "" || hash !== "") return;
  if (isLookupHistoryEntry(window.history.state)) return;
  window.history.pushState({ [LOOKUP_HISTORY_MARK]: true }, "", "/");
};
// S02-HISTORY-ENTRY:END

/** Any of these since the page loaded means the customer is busy elsewhere: a deep-link result then must not take focus (spec §5). */
const INTERACTION_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

type FocusTarget = "heading" | "input" | null;

function HomePageContent({ initialTrackingNumber }: HomePageClientProps) {
  const prefersReducedMotion = useReducedMotion();
  const announce = useAnnounce();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const interactedRef = useRef(false);
  const focusTargetRef = useRef<FocusTarget>(null);
  const startedInitialRef = useRef<string | null>(null);
  const manualLookupPendingRef = useRef(false); // S02-HISTORY-ENTRY
  const [view, setView] = useState<TrackingViewModel | null>(null);
  const [resultHidden, setResultHidden] = useState(false);

  // Candidate B (spec §3, S02): the lookup has already started (effect below). Once the App Router has committed, stash the number
  // for restore, remove it from the URL, and report the result to the ad gate.
  useEffect(() => {
    if (!initialTrackingNumber) return;
    void scrubNumberFromUrl({
      timeoutMs: SCRUB_TIMEOUT_MS,
      beforeReplace: () => saveRestoreEntry({ number: initialTrackingNumber, carrier: "AUTO", savedAt: Date.now() })
    }).then((status) => {
      if (status === "scrubbed" || status === "failed") setAdSignals({ scrub: status });
    });
  }, [initialTrackingNumber]);

  const restoreEntry = useSyncExternalStore(subscribeToNothing, getRestoreSnapshot, getServerRestoreSnapshot);
  const restoredRequest = initialTrackingNumber ? null : restoreEntry;
  const initialRequest = useMemo<LookupRequest | null>(() => {
    if (initialTrackingNumber) return { number: toRequestNumber(initialTrackingNumber), carrier: "AUTO", entry: "deepLink" };
    if (restoredRequest) return { number: restoredRequest.number, carrier: restoredRequest.carrier, entry: "restore" };
    return null;
  }, [initialTrackingNumber, restoredRequest]);
  const initialKey = initialRequest === null ? null : `${initialRequest.entry}:${initialRequest.number}:${initialRequest.carrier}`;

  const [value, setValue] = useState(initialTrackingNumber);
  const [carrier, setCarrier] = useState<DeliveryCarrierCode>("AUTO");
  const [syncedInitialKey, setSyncedInitialKey] = useState<string | null>(null);
  // A deep link or a restored lookup fills the form during render rather than in an effect (S02 pattern).
  if (initialRequest !== null && initialKey !== syncedInitialKey) {
    setSyncedInitialKey(initialKey);
    setValue(initialRequest.number);
    setCarrier(initialRequest.carrier);
  }

  const handleSettled = useCallback(
    (outcome: LookupOutcome, now: Date) => {
      const next = deriveStatusView(outcome, now);
      setView(next);
      if (next.mode === "settled") announce(next.liveMessage);
      const fromLink = outcome.request.entry === "deepLink" || outcome.request.entry === "restore";
      focusTargetRef.current = fromLink && interactedRef.current ? null : next.guideKey === "invalidNumber" ? "input" : "heading";
      // S02-HISTORY-ENTRY:BEGIN
      if (manualLookupPendingRef.current) {
        manualLookupPendingRef.current = false;
        pushLookupHistoryEntry();
      }
      // S02-HISTORY-ENTRY:END
    },
    [announce]
  );

  const { state, loading, submit, retry, cancel } = useLookup({ config: LOADING_CONFIG, onSettled: handleSettled });

  /** Every lookup start overwrites the tab's restore entry and consumes a pending restore (S02). */
  const beginLookup = useCallback(
    (request: LookupRequest) => {
      markRestoreConsumed();
      saveRestoreEntry({ number: request.number, carrier: request.carrier, savedAt: Date.now() });
      manualLookupPendingRef.current = request.entry === "manual"; // S02-HISTORY-ENTRY
      submit(request);
    },
    [submit]
  );

  // Deep links and restored lookups start right after hydration (candidate B ②); the ref keeps Strict Mode from starting twice.
  useEffect(() => {
    if (initialRequest === null || startedInitialRef.current === initialKey) return;
    startedInitialRef.current = initialKey;
    beginLookup(initialRequest);
  }, [beginLookup, initialKey, initialRequest]);

  useEffect(() => {
    const markInteracted = (): void => {
      interactedRef.current = true;
    };
    for (const name of INTERACTION_EVENTS) window.addEventListener(name, markInteracted, { capture: true, passive: true });
    return () => {
      for (const name of INTERACTION_EVENTS) window.removeEventListener(name, markInteracted, { capture: true });
    };
  }, []);

  // After a settled view is on screen: focus the visible status heading, or the input for a malformed number (spec §5).
  useEffect(() => {
    const target = focusTargetRef.current;
    if (target === null || view === null) return;
    focusTargetRef.current = null;
    if (target === "input") inputRef.current?.focus();
    else headingRef.current?.focus();
  }, [view]);

  // S02-HISTORY-ENTRY:BEGIN
  useEffect(() => {
    const onPopState = (event: PopStateEvent): void => {
      if (window.location.pathname !== "/") return;
      setResultHidden(!isLookupHistoryEntry(event.state));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  // S02-HISTORY-ENTRY:END

  const handleFormSubmit = useCallback(() => {
    const number = toRequestNumber(value);
    if (number === "") {
      inputRef.current?.focus();
      return;
    }
    setResultHidden(false);
    beginLookup({ number, carrier, entry: "manual" });
  }, [beginLookup, carrier, value]);

  const handleAction = useCallback(
    (action: ResultAction) => {
      switch (action.kind) {
        case "fixNumber":
          inputRef.current?.focus();
          inputRef.current?.select();
          return;
        case "retry":
          retry();
          return;
        case "cancel":
          cancel();
          inputRef.current?.focus();
          return;
        case "chooseCarrier":
          setCarrier(action.carrier);
          beginLookup({ number: view?.number.raw ?? toRequestNumber(value), carrier: action.carrier, entry: "carrierChip" });
          return;
        case "copied":
        case "openedExternal":
          return;
      }
    },
    [beginLookup, cancel, retry, value, view]
  );

  const slotState = resultHidden ? INITIAL_LOOKUP_STATE : state;
  const slotView = resultHidden ? null : view;
  const idle = slotState.phase === "idle";
  const busy = state.phase === "loading";
  const invalid = slotState.phase === "error" && slotView?.guideKey === "invalidNumber";
  const settledData = slotState.phase === "settled" ? slotState.outcome.data : null;
  const recommendationStage = recommendationStageOf(slotView);
  // Stores outside 지금 할 일 only on the idle page (spec §7–§8): problem states and in transit show none, delivered leads in the block.
  const showStorefront = idle;

  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader showStorefront={showStorefront} />
      <StoreContactPopup visible={idle} />
      <main id="main-content" className="mx-auto min-h-[100dvh] w-full max-w-6xl px-4 pb-10 sm:px-6">
        <section id="tracking" data-ad-exclude="true" className="scroll-mt-24 pb-9 pt-4 sm:pb-14 sm:pt-10">
          <motion.div
            className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-8"
            // No enter animation for the lookup hero: the server HTML must paint it (spec §12, PERF-02).
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
          >
            <div className="lg:col-span-6">
              <div className="inline-flex rounded-lg border border-cyan-300/35 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">
                구매 고객을 위한 배송조회
              </div>
              <h1 className="mt-5 max-w-2xl break-keep text-balance text-[2rem] font-semibold leading-[1.12] text-slate-50 sm:mt-6 sm:text-5xl lg:text-5xl">
                통관부터 국내 배송까지 <span className="whitespace-nowrap text-cyan-200">한 번에 확인</span>
              </h1>
              <p className="section-copy mt-4 max-w-xl text-sm sm:mt-5 sm:text-base">
                HBL 또는 운송장 번호 하나로 현재 통관 단계와 국내 배송 내역을 확인하세요. <span className="whitespace-nowrap">기다려야 하는 이유와</span>{" "}
                <span className="whitespace-nowrap">다음 행동까지 안내합니다.</span>
              </p>

              <LogisticsFlow />
            </div>

            <Card
              id="tracking-panel"
              data-ad-exclude="true"
              className="relative overflow-hidden rounded-[1.4rem] border-white/70 bg-slate-50 p-4 text-slate-950 shadow-2xl sm:p-7 lg:col-span-6 lg:p-8"
            >
              <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-cyan-300/30 blur-3xl" aria-hidden="true" />
              <div className="relative">
                <p className="text-sm font-semibold text-cyan-700">배송 조회</p>
                <h2 className="mt-2 break-keep text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">내 배송은 어디쯤일까요?</h2>
                <p className="mt-3 break-keep text-sm leading-6 text-slate-600">
                  번호를 입력하면 조회 시점 기준 최신 정보를 불러옵니다.
                </p>
                <div className="mt-6">
                  <TrackingForm
                    value={value}
                    onValueChange={setValue}
                    carrier={carrier}
                    onCarrierChange={setCarrier}
                    onSubmit={handleFormSubmit}
                    busy={busy}
                    invalid={invalid}
                    inputRef={inputRef}
                    surface="light"
                  />
                  <StatusSlot state={slotState} loading={loading} view={slotView} onAction={handleAction} headingRef={headingRef} />
                </div>
              </div>
            </Card>
          </motion.div>

          <div className="mt-6">
            <AssuranceRail />
          </div>
        </section>

        <div className="mx-auto max-w-5xl">
          {settledData ? (
            <section aria-label="배송 조회 결과" data-ad-exclude="true" className="space-y-4 pb-8">
              <section className="space-y-3 pt-3" aria-labelledby="tracking-details-title">
                <div>
                  <h3 id="tracking-details-title" className="text-lg font-bold text-slate-50">상세 진행 내역</h3>
                  <p className="mt-1 text-sm text-slate-400">최근 통관과 국내 배송 내역이 필요한 경우에만 확인하세요.</p>
                </div>
                <div className="grid items-start gap-4 lg:grid-cols-2">
                  <div className="order-2 lg:order-1">
                    <CustomsTimeline events={settledData.customs.events} />
                  </div>
                  <div className="order-1 lg:order-2">
                    <DeliveryTimeline delivery={settledData.delivery} waitingMessage={getDeliveryWaitingMessage(settledData)} />
                  </div>
                </div>
              </section>
              {recommendationStage ? <RecommendedProducts context={recommendationStage} /> : null}
            </section>
          ) : null}
        </div>

        {showStorefront ? <StorefrontShowcase /> : null}
        <ServiceGuide />
        <SiteFooter />
      </main>
    </MotionConfig>
  );
}

export const HomePageClient = ({ initialTrackingNumber }: HomePageClientProps) => (
  <LiveAnnouncerProvider>
    <HomePageContent initialTrackingNumber={initialTrackingNumber} />
  </LiveAnnouncerProvider>
);
