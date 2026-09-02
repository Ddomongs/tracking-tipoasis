import { ArrowUpRight, CalendarDays, Check, Clock3, MessageCircle, RefreshCw, Ship, Truck } from "lucide-react";
import { AnimatedIcon } from "@/components/AnimatedIcon";
import { TALK_URL } from "@/lib/storefront";
import type { StatusCode, TrackResponseData } from "@/lib/types";
import { cn } from "@/lib/utils";

type TrackingResultSummaryProps = {
  readonly data: TrackResponseData;
};

const statusTitleByCode: Record<StatusCode, string> = {
  1: "입항 정보 확인 중",
  2: "통관대기",
  3: "통관 심사 중",
  4: "통관 완료",
  5: "택배사 인계 중",
  6: "국내 배송 중",
  7: "배송 완료"
};

const statusHintByCode: Record<StatusCode, string> = {
  1: "해외에서 도착한 상품의 입항 정보가 순서대로 등록되고 있습니다.",
  2: "세관 접수가 끝나 통관 순서를 기다리고 있습니다.",
  3: "세관에서 상품 신고 내용을 확인하고 있습니다.",
  4: "세관 처리가 끝나 국내 택배사 전달을 기다리고 있습니다.",
  5: "상품이 국내 택배사로 전달되고 있습니다.",
  6: "택배사가 고객님 주소로 상품을 배송하고 있습니다.",
  7: "고객님께 상품 배송이 완료되었습니다."
};

const actionByCode: Record<StatusCode, string> = {
  1: "정상 진행 중입니다. 통관 정보가 등록될 때까지 조금만 기다려 주세요.",
  2: "정상 통관 대기 상태입니다. 지금은 별도 문의 없이 조금만 기다려 주세요.",
  3: "통관 심사가 진행 중입니다. 추가 확인이 없다면 곧 통관이 완료됩니다.",
  4: "통관은 끝났습니다. 국내 택배사에 전달될 때까지 기다려 주세요.",
  5: "택배사에 전달 중입니다. 국내 배송 내역이 등록될 때까지 기다려 주세요.",
  6: "배송 중입니다. 문자로 안내된 배송 예정 시간을 확인해 주세요.",
  7: "배송이 완료됐습니다. 상품 상태를 확인해 주세요."
};

const journeySteps = [
  { label: "해외 이동", icon: Ship },
  { label: "통관 진행", icon: Clock3 },
  { label: "국내 배송", icon: Truck }
] as const;

const formatDate = (isoText?: string): string => {
  if (!isoText) return "정보 확인 중";
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) return "정보 확인 중";

  return date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short"
  });
};

const formatUpdatedAt = (isoText: string): string => {
  const date = new Date(isoText);
  if (Number.isNaN(date.getTime())) return "방금 전";

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const getDateBadge = (isoText?: string, completed = false): string | undefined => {
  if (completed) return "완료";
  if (!isoText) return undefined;

  const target = new Date(isoText);
  if (Number.isNaN(target.getTime())) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (days > 0) return `D-${days}`;
  if (days === 0) return "오늘 예상";
  return "예정일 재확인 중";
};

const getJourneyIndex = (data: TrackResponseData): number => {
  if (data.isPending || data.delivery.lookupUnavailable || data.delivery.ambiguous) return -1;
  if (data.currentStatusCode <= 1) return 0;
  if (data.currentStatusCode <= 4) return 1;
  return 2;
};

const isPickupStatus = (data: TrackResponseData): boolean =>
  data.currentStatusCode === 5 && /(집화|집하|상품\s*인수)/.test(data.currentStatus);

const getCarrierName = (data: TrackResponseData): string =>
  /자동\s*(조회|확인)|자동으로/.test(data.delivery.carrier) ? "택배사" : data.delivery.carrier;

const getStatusTitle = (data: TrackResponseData): string => {
  if (data.delivery.ambiguous) return "택배사 선택 필요";
  if (data.delivery.lookupUnavailable) return "조회가 잠시 지연 중";
  if (data.isPending) return "통관 정보 등록 전";
  if (isPickupStatus(data)) return `${getCarrierName(data)} 기사님 픽업 완료!`;
  return statusTitleByCode[data.currentStatusCode];
};

const getStatusHint = (data: TrackResponseData): string => {
  if (data.delivery.ambiguous) return "같은 번호가 여러 택배사에서 확인돼 택배사 선택이 필요합니다.";
  if (data.delivery.lookupUnavailable) return "택배사 응답이 늦어 최신 정보를 불러오지 못했습니다.";
  if (data.isPending) return "아직 입항·통관 내역이 등록되지 않았습니다.";
  if (isPickupStatus(data)) return `${getCarrierName(data)} 기사님이 상품을 인수해 배송 출발을 준비하고 있습니다.`;
  return statusHintByCode[data.currentStatusCode];
};

const getNextAction = (data: TrackResponseData): string => {
  if (data.delivery.ambiguous) return "위 조회창에서 이용한 택배사를 선택해 다시 조회해 주세요.";
  if (data.delivery.lookupUnavailable) return "잠시 후 다시 조회하거나 택배사 공식 조회 링크를 이용해 주세요.";
  if (data.isPending) return "정보 반영까지 시간이 걸릴 수 있어 2~3시간 뒤 다시 확인해 주세요.";
  if (isPickupStatus(data)) return "픽업이 완료됐습니다. 배송 이동이 시작되면 현재 위치가 업데이트됩니다.";
  return actionByCode[data.currentStatusCode];
};

export const TrackingResultSummary = ({ data }: TrackingResultSummaryProps) => {
  const journeyIndex = getJourneyIndex(data);
  const deliveryCompleted = data.currentStatusCode === 7 && !data.isPending;
  const deliveryDateLabel = deliveryCompleted ? "배송 완료일" : "배송 완료 예상일";
  const deliveryDateValue = data.isPending ? "일정 확인 중" : formatDate(data.estimatedDeliveryDate);
  const deliveryDateBadge = data.isPending ? "정보 대기" : getDateBadge(data.estimatedDeliveryDate, deliveryCompleted);
  const customsCompleted = data.currentStatusCode >= 4 && !data.isPending;
  const customsDateLabel = customsCompleted
    ? data.estimatedCustomsClearanceDate
      ? "통관 완료일"
      : "통관 상태"
    : "통관완료 예상일";
  const customsDateValue = data.isPending
    ? "정보 등록 후 안내"
    : customsCompleted && !data.estimatedCustomsClearanceDate
      ? "통관 완료"
      : formatDate(data.estimatedCustomsClearanceDate);
  const customsDateBadge = data.isPending
    ? "등록 대기"
    : getDateBadge(data.estimatedCustomsClearanceDate, customsCompleted);
  const statusTitle = getStatusTitle(data);
  const statusHint = getStatusHint(data);
  const nextAction = getNextAction(data);

  return (
    <section data-tracking-result-summary="true" className="brand-panel overflow-hidden" aria-label="배송 조회 핵심 안내">
      <header className="flex items-center justify-between gap-3 border-b border-slate-700/70 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <AnimatedIcon kind="result" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-200">조회번호</p>
            <p className="truncate text-sm font-semibold text-slate-100 sm:text-base">{data.trackingNumber}</p>
          </div>
        </div>
        <a
          href="#tracking"
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-950/45 px-3 text-xs font-semibold text-slate-200 transition hover:border-cyan-200/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80 sm:text-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">다른 번호 조회</span>
          <span className="sm:hidden">다시 조회</span>
        </a>
      </header>

      <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
        <div className="bg-[linear-gradient(135deg,rgba(8,47,73,0.92),rgba(6,78,59,0.55))] p-5 sm:p-7">
          <p className="text-xs font-bold text-cyan-100/80">지금 상황</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h3 className="break-keep text-[1.75rem] font-bold leading-tight text-white sm:text-4xl">{statusTitle}</h3>
            <span className="rounded-full border border-emerald-200/30 bg-emerald-200/10 px-2.5 py-1 text-xs font-bold text-emerald-100">
              {data.isPending ? "정보 대기" : `${data.currentStatusCode}단계`}
            </span>
          </div>
          <p className="mt-3 max-w-xl break-keep text-sm leading-6 text-slate-200 sm:text-base">{statusHint}</p>

          <div className="mt-5 rounded-2xl border border-cyan-200/20 bg-slate-950/35 p-4">
            <p className="text-xs font-bold text-cyan-200">지금은 이렇게 해주세요</p>
            <p className="mt-1.5 break-keep text-sm font-medium leading-6 text-white">{nextAction}</p>
          </div>
        </div>

        <div className="bg-slate-50 p-5 text-slate-950 sm:p-7" data-delivery-estimate="true">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-cyan-700">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
              <p className="text-sm font-bold">{deliveryDateLabel}</p>
            </div>
            {deliveryDateBadge ? (
              <span className="shrink-0 rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-bold text-cyan-800">{deliveryDateBadge}</span>
            ) : null}
          </div>
          <p className="mt-5 break-keep text-[2rem] font-black leading-none tracking-tight text-slate-950 sm:text-[2.45rem]">
            {deliveryDateValue}
          </p>
          <p className="mt-3 break-keep text-sm leading-6 text-slate-600">
            {deliveryCompleted
              ? "택배사에서 확인된 배송 완료 시각입니다."
              : data.estimatedDeliveryDate
                ? data.customs.estimateAdjusted
                  ? "현재도 통관 대기 중인 상태를 반영해 오늘 이후 기준으로 다시 계산했습니다."
                  : "현재 통관·배송 단계의 최근 처리 시각을 기준으로 계산한 예상일입니다."
                : "배송 정보가 확인되면 예상 도착일을 바로 안내해 드립니다."}
          </p>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4" data-customs-estimate="true">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">{customsDateLabel}</p>
                <p className="mt-1 font-bold text-slate-800">{customsDateValue}</p>
              </div>
              {customsDateBadge ? (
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{customsDateBadge}</span>
              ) : null}
            </div>
            {data.customs.estimateAdjusted ? (
              <p className="mt-2 text-[11px] font-medium text-cyan-700">현재 통관 상태를 반영해 예상일을 다시 계산했습니다.</p>
            ) : null}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">통관·기상·택배사 사정에 따라 실제 배송 일정은 달라질 수 있습니다.</p>
        </div>
      </div>

      <div className="border-t border-slate-700/70 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-100">전체 흐름 한눈에 보기</p>
          <p className="text-xs text-slate-400">3개 구간</p>
        </div>
        <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="배송 진행 구간">
          {journeySteps.map((step, index) => {
            const isCompleted = data.currentStatusCode === 7 || (journeyIndex >= 0 && index < journeyIndex);
            const isCurrent = data.currentStatusCode !== 7 && journeyIndex === index;
            const Icon = step.icon;

            return (
              <li
                key={step.label}
                className={cn(
                  "rounded-xl border px-2 py-3 text-center",
                  isCompleted && "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
                  isCurrent && "border-cyan-200/50 bg-cyan-200/10 text-cyan-50",
                  !isCompleted && !isCurrent && "border-slate-700/70 bg-slate-950/35 text-slate-500"
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-current/30">
                  {isCompleted ? <Check className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
                </span>
                <p className="mt-2 break-keep text-[11px] font-bold sm:text-xs">{step.label}</p>
                <p className="mt-0.5 text-[10px] opacity-75">{isCompleted ? "완료" : isCurrent ? "진행 중" : "다음"}</p>
              </li>
            );
          })}
        </ol>
      </div>

      <footer className="flex flex-col gap-3 border-t border-slate-700/70 bg-slate-950/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          <span>{data.delivery.carrier}</span>
          <span>업데이트 {formatUpdatedAt(data.lastUpdated)}</span>
        </div>
        <a
          href={TALK_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="기타 문의는 톡톡으로 문의하기 새 창으로 열기"
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-cyan-200/30 bg-cyan-200/10 px-3 text-xs font-bold text-cyan-100 transition hover:bg-cyan-200/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          기타 문의하기
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </footer>
    </section>
  );
};
