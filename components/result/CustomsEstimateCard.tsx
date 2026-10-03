import type { CustomsEstimateView } from "@/lib/tracking/types";

const CHIP = "inline-flex min-h-[32px] items-center rounded-full bg-tt-ground px-3 text-tt-sm font-bold [word-break:keep-all]";

/** '통관 2일 + 주말·공휴일 1일', or only the part that is not zero. */
function daysText({ businessDays, offDays }: CustomsEstimateView): string | null {
  if (businessDays > 0 && offDays > 0) return `통관 ${businessDays}일 + 주말·공휴일 ${offDays}일`;
  if (businessDays > 0) return `통관 ${businessDays}일`;
  return offDays > 0 ? `주말·공휴일 ${offDays}일 포함` : null;
}

/**
 * '통관 완료 예상일' (10월 2일 요청): the clearance estimate with its D-day and how it was reached — the arrival day, then
 * customs working days and weekend·holiday days up to the estimate. Always labelled 참고용: the date is not a promise.
 */
export function CustomsEstimateCard({ estimate, id }: { readonly estimate: CustomsEstimateView; readonly id: string }): React.JSX.Element {
  const dday = estimate.dday === 0 ? "오늘" : `D-${estimate.dday}`;
  return (
    <section
      data-customs-estimate="true"
      aria-labelledby={id}
      className="flex flex-col items-center gap-3 border-2 border-solid border-tt-rule bg-tt-surface px-4 py-5 text-center text-tt-ink"
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <h3 id={id} className="m-0 text-tt-md font-bold">
          통관 완료 예상일
        </h3>
        <span className="rounded-full border border-solid border-tt-attention-ink px-2 py-0.5 text-tt-xs font-bold text-tt-attention-ink">
          참고용 · 확정된 날짜 아님
        </span>
      </div>
      <p className="m-0 flex flex-wrap items-center justify-center gap-2">
        <span className="font-tt-display text-tt-eta leading-tight [font-weight:var(--tt-weight-display)]">{estimate.date.label}</span>
        <span data-customs-dday="true" className="rounded-full bg-tt-accent px-3 py-1 text-tt-sm font-bold text-tt-on-primary">
          {dday}
        </span>
      </p>
      {estimate.arrival === null ? null : (
        <p className="m-0 flex flex-wrap justify-center gap-2">
          <span className={CHIP}>내 입항일 {estimate.arrival.label}</span>
          {daysText(estimate) === null ? null : <span className={CHIP}>{daysText(estimate)}</span>}
        </p>
      )}
      <p className="m-0 text-tt-xs text-tt-muted [word-break:keep-all]">
        관세청 기록을 바탕으로 계산한 참고용 날짜예요. 세관 검사나 서류 확인이 있으면 늦어질 수 있어요.
      </p>
    </section>
  );
}
