import type { CustomsBatchView, CustomsEstimateView, EtaDate } from "@/lib/tracking/types";

const ROW = "flex min-h-[56px] items-center gap-3 rounded-tt-card px-4 py-2";
const FACT = "flex items-baseline justify-between gap-3 text-tt-sm";

/** '통관 3일 + 주말·공휴일 2일', or only the part that is not zero. */
function daysText({ businessDays, offDays }: CustomsEstimateView): string | null {
  if (businessDays > 0 && offDays > 0) return `통관 ${businessDays}일 + 주말·공휴일 ${offDays}일`;
  if (businessDays > 0) return `통관 ${businessDays}일`;
  return offDays > 0 ? `주말·공휴일 ${offDays}일 포함` : null;
}

function ddayText(dday: number): string {
  return dday === 0 ? "오늘" : `D-${dday}`;
}

function WindowRow({ label, date, dday, early }: { readonly label: string; readonly date: EtaDate; readonly dday: number; readonly early: boolean }): React.JSX.Element {
  return (
    <p className={`${ROW} m-0 ${early ? "bg-tt-done text-tt-done-on" : "bg-tt-ground text-tt-ink"}`}>
      <span className="w-12 shrink-0 text-left text-tt-sm font-bold">{label}</span>
      <span className="flex-1 text-left font-tt-display text-tt-lg [font-weight:var(--tt-weight-display)] [word-break:keep-all]">{date.label}</span>
      <span
        data-customs-dday={early ? "true" : undefined}
        className="shrink-0 rounded-full bg-tt-surface px-3 py-1 text-tt-xs font-bold text-tt-ink"
      >
        {ddayText(dday)}
      </span>
    </p>
  );
}

/** A ring with the cleared share of this shipment's batch (same ship, same arrival) and how much of it went today. */
function BatchProgress({ batch, arrival }: { readonly batch: CustomsBatchView; readonly arrival: EtaDate | null }): React.JSX.Element {
  const ring = `conic-gradient(var(--tt-tone-done-ink) ${batch.percent * 3.6}deg, var(--tt-rule) 0deg)`;
  const subject = arrival === null ? "같은 배로 온 화물" : `${arrival.month}월 ${arrival.day}일 같은 배 입항건`;
  return (
    <div data-customs-batch="true" className="flex items-center gap-3 border-0 border-t border-solid border-tt-rule pt-3 text-left">
      <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-full" style={{ background: ring }}>
        <span className="grid h-11 w-11 place-items-center rounded-full bg-tt-surface text-tt-xs font-bold">{batch.percent}%</span>
      </span>
      <span className="flex flex-col gap-0.5 [word-break:keep-all]">
        <span className="text-tt-sm font-bold">
          {subject} <span className="text-tt-done-ink">{batch.percent}% 통관 완료</span>
        </span>
        <span className="text-tt-xs text-tt-muted">
          {batch.todayPercent > 0 ? `오늘 ${batch.todayPercent}% 처리 · 지금 통관이 진행 중이에요` : "오늘은 아직 처리된 화물이 없어요"}
        </span>
      </span>
    </div>
  );
}

/**
 * '통관 완료 예상일' (10월 2일 요청, 11월 27일 개편): 빠르면 / 늦으면 window counted from the official arrival day, how
 * it was reached, and — when sampled — how far customs got with the same batch. Always labelled 참고용.
 */
export function CustomsEstimateCard({ estimate, id }: { readonly estimate: CustomsEstimateView; readonly id: string }): React.JSX.Element {
  const days = daysText(estimate);
  return (
    <section
      data-customs-estimate="true"
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-tt-card border-2 border-solid border-tt-rule bg-tt-surface px-4 py-4 text-tt-ink"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={id} className="m-0 text-tt-md font-bold">
          통관 완료 예상일
        </h3>
        <span className="text-tt-xs text-tt-muted">참고용 · 실시간 변동</span>
      </div>
      <div className="flex flex-col gap-2">
        <WindowRow label={estimate.latest === null ? "예상" : "빠르면"} date={estimate.date} dday={estimate.dday} early />
        {estimate.latest === null ? null : (
          <WindowRow label="늦으면" date={estimate.latest} dday={estimate.latestDday ?? 0} early={false} />
        )}
      </div>
      {estimate.arrival === null ? null : (
        <div className="flex flex-col gap-1 px-1">
          <p className={`${FACT} m-0`}>
            <span className="text-tt-muted">내 입항일</span>
            <span className="font-bold">{estimate.arrival.label}</span>
          </p>
          {days === null ? null : (
            <p className={`${FACT} m-0`}>
              <span className="text-tt-muted">예상 소요일</span>
              <span className="font-bold">{days}</span>
            </p>
          )}
        </div>
      )}
      {estimate.batch === null ? null : <BatchProgress batch={estimate.batch} arrival={estimate.arrival} />}
      <p className="m-0 text-tt-xs text-tt-muted [word-break:keep-all]">
        관세청 기록과 같은 배 화물의 처리 현황으로 계산한 참고용 날짜예요. 세관 검사나 서류 확인이 있으면 늦어질 수 있어요.
      </p>
    </section>
  );
}
