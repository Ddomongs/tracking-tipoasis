"use client";

import { useCallback, useRef, useState } from "react";
import { AssuranceRail } from "@/components/AssuranceRail";
import { CustomerCta } from "@/components/CustomerCta";
import type { ResultCustomerCtaState } from "@/components/CustomerCta";
import { motion, MotionConfig, useReducedMotion } from "framer-motion";
import { CustomsTimeline } from "@/components/CustomsTimeline";
import { DeliveryTimeline } from "@/components/DeliveryTimeline";
import { ErrorMessage } from "@/components/ErrorMessage";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { LogisticsFlow } from "@/components/LogisticsFlow";
import { ServiceGuide } from "@/components/ServiceGuide";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { StoreContactPopup } from "@/components/StoreContactPopup";
import { StorefrontShowcase } from "@/components/StorefrontShowcase";
import { RecommendedProducts } from "@/components/RecommendedProducts";
import { TrackingForm } from "@/components/TrackingForm";
import { TrackingResultSummary } from "@/components/TrackingResultSummary";
import { Card } from "@/components/ui/card";
import type { TrackResponseData } from "@/lib/types";

type HomePageClientProps = {
  initialTrackingNumber: string;
};

const getResultCustomerCtaState = (data: TrackResponseData): ResultCustomerCtaState => {
  if (data.delivery.ambiguous) return "pending";
  if (data.delivery.lookupUnavailable) return "pending";
  if (data.isPending) return "pending";
  if (data.currentStatusCode === 7) return "delivered";
  return "inTransit";
};

export const HomePageClient = ({ initialTrackingNumber }: HomePageClientProps) => {
  const [result, setResult] = useState<TrackResponseData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const resultTopRef = useRef<HTMLHeadingElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const handleSuccess = useCallback((data: TrackResponseData) => {
    setResult(data);
    setError("");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resultTopRef.current?.focus({ preventScroll: true });
        resultTopRef.current?.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start"
        });
      });
    });
  }, [prefersReducedMotion]);

  const handleError = useCallback((message: string) => {
    setError(message);
    if (message) setResult(null);
  }, []);

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

  const showStorefront = !loading && !error && (!result || result.currentStatusCode === 7);

  return (
    <MotionConfig reducedMotion="user">
      <SiteHeader showStorefront={showStorefront} />
      <StoreContactPopup visible={!loading && !error && !result} />
      <main id="main-content" className="mx-auto min-h-[100dvh] w-full max-w-6xl px-4 pb-10 sm:px-6">
        <section id="tracking" data-ad-exclude="true" className="scroll-mt-24 pb-9 pt-4 sm:pb-14 sm:pt-10">
          <motion.div
            className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-8"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
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
                    onSuccess={handleSuccess}
                    onError={handleError}
                    onLoading={setLoading}
                    initialTrackingNumber={initialTrackingNumber}
                    surface="light"
                  />
                </div>
              </div>
            </Card>
          </motion.div>

          <div className="mt-6">
            <AssuranceRail />
          </div>
        </section>

        <div className="mx-auto max-w-5xl">
          {error && !loading ? (
            <section className="mb-8 space-y-3" aria-live="assertive">
              <ErrorMessage message={error} />
              <CustomerCta variant="result" state="error" />
            </section>
          ) : null}

          {loading ? (
            <section aria-live="polite" aria-busy="true">
              <p className="sr-only">배송 정보를 조회하고 있습니다.</p>
              <LoadingSpinner />
            </section>
          ) : result ? (
            <motion.section
              className="space-y-4 pb-8"
              aria-labelledby="tracking-result-title"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
            >
              <h2
                ref={resultTopRef}
                id="tracking-result-title"
                tabIndex={-1}
                className="sr-only scroll-mt-24 outline-none"
              >
                배송 조회 결과
              </h2>
              <p role="status" className="sr-only">
                현재 배송 상태는 {result.currentStatus}입니다.
              </p>
              <TrackingResultSummary data={result} />
              <section className="space-y-3 pt-3" aria-labelledby="tracking-details-title">
                <div>
                  <h3 id="tracking-details-title" className="text-lg font-bold text-slate-50">상세 진행 내역</h3>
                  <p className="mt-1 text-sm text-slate-400">최근 통관과 국내 배송 내역이 필요한 경우에만 확인하세요.</p>
                </div>
                <div className="grid items-start gap-4 lg:grid-cols-2">
                  <div className="order-2 lg:order-1">
                    <CustomsTimeline events={result.customs.events} />
                  </div>
                  <div className="order-1 lg:order-2">
                    <DeliveryTimeline delivery={result.delivery} waitingMessage={getDeliveryWaitingMessage(result)} />
                  </div>
                </div>
              </section>
              <CustomerCta variant="result" state={getResultCustomerCtaState(result)} />
              <RecommendedProducts
                statusCode={result.currentStatusCode}
                isPending={result.isPending || result.delivery.lookupUnavailable || result.delivery.ambiguous}
              />
            </motion.section>
          ) : null}
        </div>

        {!loading && !error && showStorefront ? <StorefrontShowcase /> : null}
        <ServiceGuide />
        <SiteFooter />
      </main>
    </MotionConfig>
  );
};
