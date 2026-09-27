"use client";

import { CustomsTimeline } from "@/components/CustomsTimeline";
import { DeliveryTimeline } from "@/components/DeliveryTimeline";
import { RecommendedProducts } from "@/components/RecommendedProducts";
import type { RecommendationStage } from "@/components/RecommendedProducts";
import { StatusSlot, type StatusSlotProps } from "@/components/status-slot/StatusSlot";
import type { LookupOutcome, TrackingViewModel } from "@/lib/tracking/types";
import type { TrackResponseData } from "@/lib/types";

export type LegacyDeriver = (outcome: LookupOutcome, now: Date) => TrackingViewModel;

let loadedDeriver: LegacyDeriver | null = null;
let pendingDeriver: Promise<LegacyDeriver> | null = null;

/** The deriver when its chunk has already arrived, so a settled lookup renders in the same task. */
export function getLoadedLegacyDeriver(): LegacyDeriver | null {
  return loadedDeriver;
}

/**
 * S04's deriveStatusView (deriveTrackingView plus S04's approval-2/3 fallbacks) through a dynamic import (contract §11.1
 * rule 3): deriveTrackingView, siteConfig and zod stay out of the lookup island's static graph, and the page shows exactly
 * the views S04's E2E files expect. Preloaded when a lookup starts; a failed chunk can be retried. S07 replaces this with
 * loadResultModule() and deletes the file.
 */
export function loadLegacyDeriver(): Promise<LegacyDeriver> {
  if (loadedDeriver !== null) return Promise.resolve(loadedDeriver);
  if (pendingDeriver === null) {
    pendingDeriver = import("@/components/status-slot/status-view").then(
      (statusView) => {
        const deriver: LegacyDeriver = statusView.deriveStatusView;
        loadedDeriver = deriver;
        return deriver;
      },
      (error: unknown) => {
        pendingDeriver = null;
        throw error;
      }
    );
  }
  return pendingDeriver;
}

// ---- S04's legacy result details (from S04's HomePageClient), unchanged until S07 deletes this file ----

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

/** Inline recommendations only where the view places them (spec §8); the legacy list knows pending, in transit and delivered. */
const recommendationStageOf = (view: TrackingViewModel | null): RecommendationStage | null => {
  if (view === null || view.mode !== "settled" || view.revenue.recommendations !== "inline") return null;
  const context = view.revenue.recommendationContext;
  return context === "pending" || context === "inTransit" || context === "delivered" ? context : null;
};

/**
 * Transitional result area (S06 → S07): S04's status slot, then S04's legacy result details, on the dark legacy band.
 * The details container has no accessible name: section#tracking is the page's one '배송 조회 결과' region.
 */
export function LegacyResultSection(props: StatusSlotProps): React.JSX.Element {
  const settledData = props.state.phase === "settled" ? props.state.outcome.data : null;
  return (
    <div className="tt-legacy-dark flex flex-col gap-4 px-4 py-4">
      <StatusSlot {...props} />
      {settledData ? (
        <div data-ad-exclude="true" className="space-y-4 pb-8">
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
        </div>
      ) : null}
    </div>
  );
}

/**
 * S04's recommendations, rendered by LookupController after `#tracking-panel` so that shopping links stay out of the
 * primary flow as they did in S04 (tests/tracking.spec.ts "in-transit state keeps shopping links out of the primary flow").
 */
export function LegacyRecommendations({ state, view }: Pick<StatusSlotProps, "state" | "view">): React.JSX.Element | null {
  const stage = state.phase === "settled" ? recommendationStageOf(view) : null;
  if (stage === null) return null;
  return (
    <div data-ad-exclude="true" className="tt-legacy-dark px-4 pb-8">
      <RecommendedProducts context={stage} />
    </div>
  );
}
