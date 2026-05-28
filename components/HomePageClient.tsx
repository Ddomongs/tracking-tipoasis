"use client";

import { useCallback, useRef, useState } from "react";
import { CustomerCta } from "@/components/CustomerCta";
import { motion } from "framer-motion";
import { CustomsTimeline } from "@/components/CustomsTimeline";
import { DeliveryTimeline } from "@/components/DeliveryTimeline";
import { ErrorMessage } from "@/components/ErrorMessage";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StatusBanner } from "@/components/StatusBanner";
import { TrackingForm } from "@/components/TrackingForm";
import { Card } from "@/components/ui/card";
import type { TrackResponseData } from "@/lib/types";

type HomePageClientProps = {
  initialTrackingNumber: string;
};

export const HomePageClient = ({ initialTrackingNumber }: HomePageClientProps) => {
  const [result, setResult] = useState<TrackResponseData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const resultTopRef = useRef<HTMLDivElement | null>(null);

  const handleSuccess = useCallback((data: TrackResponseData) => {
    setResult(data);
    setError("");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        resultTopRef.current?.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start"
        });
      });
    });
  }, []);

  const formatDateOnly = (isoText?: string): string => {
    if (!isoText) return "계산 불가";
    const parsed = new Date(isoText);
    if (Number.isNaN(parsed.getTime())) return "계산 불가";
    return parsed.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short"
    });
  };

  const getDeliveryWaitingMessage = (data: TrackResponseData): string | undefined => {
    if (data.delivery.events.length > 0) return undefined;

    if (data.isPending) {
      return "택배사에 아직 운송장 이동 이력이 없습니다. 출고 직후라면 반영까지 시간이 걸릴 수 있습니다.";
    }

    if (data.customs.events.length > 0 && data.currentStatusCode >= 4) {
      return "택배사 인계를 기다리고 있습니다. 보통 통관 완료 후 0~1영업일 내 인계됩니다.";
    }

    return undefined;
  };

  return (
    <main className="pointer-events-none mx-auto min-h-screen w-full max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pb-36 sm:pt-14 lg:pb-14">
      <motion.section
        className="mb-8 space-y-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="inline-flex rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-100">
          Customs + Delivery Tracker
        </div>
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-slate-50 sm:text-5xl">실시간 AI 배송 추적 시스템</h1>
        <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
          HBL 또는 운송장 번호를 입력하면 통관 진행 단계와 CJ 배송 흐름을 타임라인으로 제공합니다.
        </p>
        <div className="grid grid-cols-1 gap-2 text-xs text-slate-200/90 sm:grid-cols-3 sm:gap-3">
          <div className="rounded-xl border border-slate-700/80 bg-slate-900/35 px-3 py-2">실시간 조회 결과 반영</div>
          <div className="rounded-xl border border-slate-700/80 bg-slate-900/35 px-3 py-2">조회 기록 미저장 정책</div>
          <div className="rounded-xl border border-slate-700/80 bg-slate-900/35 px-3 py-2">UNI-PASS + CJ 통합 타임라인</div>
        </div>
        <Card className="border-cyan-300/25 bg-slate-900/45">
          <TrackingForm
            onSuccess={handleSuccess}
            onError={setError}
            onLoading={setLoading}
            initialTrackingNumber={initialTrackingNumber}
          />
        </Card>
        <div className="hidden lg:block">
          <CustomerCta />
        </div>
        <Card className="border-amber-300/20 bg-amber-300/5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-amber-100">조회 시 주의사항</h2>
          <ul className="space-y-1 text-xs text-amber-50/90 sm:text-sm">
            <li>- 예상배송일은 최근 이벤트 기반 추정값이며 실제 배송과 다를 수 있습니다.</li>
            <li>- 택배사 허브 사정, 기상, 배송지 상황에 따라 지연될 수 있습니다.</li>
            <li>- 통관 정보는 UNI-PASS 반영 시점에 따라 수 분~수 시간 차이가 날 수 있습니다.</li>
          </ul>
        </Card>
      </motion.section>

      {error && !loading ? (
        <section className="mb-6" aria-live="assertive">
          <ErrorMessage message={error} />
        </section>
      ) : null}

      {loading ? (
        <section aria-live="polite">
          <LoadingSpinner />
        </section>
      ) : result ? (
        <>
          <div ref={resultTopRef} className="scroll-mt-6 sm:scroll-mt-8" />
          <motion.section
            className="space-y-4 pb-8"
            aria-live="polite"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-emerald-300/30 bg-gradient-to-br from-emerald-300/20 via-emerald-400/10 to-transparent">
              <p className="text-[11px] uppercase tracking-[0.1em] text-emerald-100/90">가장 중요한 정보</p>
              <p className="mt-2 text-sm text-emerald-100/90">예상배송일</p>
              <p className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                {formatDateOnly(result.estimatedDeliveryDate)}
              </p>
            </Card>

            <Card className="border-cyan-300/30 bg-gradient-to-br from-cyan-300/20 via-cyan-400/10 to-transparent">
              <p className="text-[11px] uppercase tracking-[0.1em] text-cyan-100/90">현재 상태</p>
              <p className="mt-2 text-sm text-cyan-100/90">실시간 단계</p>
              <p className="mt-1 text-2xl font-bold text-white sm:text-3xl">
                {result.currentStatus} <span className="text-cyan-100/90">(STEP {result.currentStatusCode})</span>
              </p>
            </Card>
          </div>

          <Card className="grid gap-3 border-slate-700/80 bg-slate-900/40 sm:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">조회번호</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{result.trackingNumber}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">식별 타입</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{result.type}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-slate-400">현재 단계</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">STEP {result.currentStatusCode}</p>
            </div>
          </Card>
          <StatusBanner status={result.currentStatus} code={result.currentStatusCode} isPending={result.isPending} />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <CustomsTimeline events={result.customs.events} />
            </div>
            <div className="order-1 lg:order-2">
              <DeliveryTimeline
                delivery={result.delivery}
                waitingMessage={getDeliveryWaitingMessage(result)}
              />
            </div>
          </div>
            <p className="text-right text-xs text-slate-400/90">
              최종 업데이트: {new Date(result.lastUpdated).toLocaleString("ko-KR")}
            </p>
          </motion.section>
        </>
      ) : (
        <section className="pt-6 text-sm text-slate-300/85">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-900/35 px-4 py-5 sm:px-6">
            조회 예시: <span className="font-medium text-slate-100">509493884901</span>,{" "}
            <span className="font-medium text-slate-100">509493884853</span>
          </div>
        </section>
      )}
      <CustomerCta variant="mobileFixed" />
    </main>
  );
};
