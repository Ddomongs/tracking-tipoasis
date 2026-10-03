import { EtaDisplay } from "@/components/primitives/EtaDisplay";
import { JourneySpine } from "@/components/primitives/JourneySpine";
import { NoticeBanner } from "@/components/primitives/NoticeBanner";
import { StatusChip } from "@/components/primitives/StatusChip";
import type { TrackingViewModel } from "@/lib/tracking/types";

export interface StatusCardProps {
  readonly view: TrackingViewModel;
  readonly titleId: string;
  readonly headingRef?: React.Ref<HTMLHeadingElement>;
  /** Extra rows at the bottom of the field (the auxiliary '택배사 조회가 잠시 늦어요 [다시 조회]' line). */
  readonly children?: React.ReactNode;
}

/**
 * 상태 카드 (spec §6): chip, the status h2 (focus target: tabindex -1, never role=alert), the reason,
 * the 4-station spine, the in-card '안내' line and then 도착 예상 — all inside the active style's status-head field.
 * data-guide-key / data-overdue / data-tone on the root are the E2E hooks (contract §11.13).
 */
export function StatusCard({ view, titleId, headingRef, children }: StatusCardProps): React.JSX.Element {
  return (
    <section
      data-guide-key={view.guideKey}
      data-overdue={view.overdue ? "true" : "false"}
      data-tone={view.tone}
      aria-labelledby={titleId}
    >
      <div data-slot="status-head" data-tone={view.tone}>
        <div className="flex flex-col items-start gap-2">
          {view.chip === null ? null : <StatusChip tone={view.tone} text={view.chip} />}
          <div className="flex flex-col gap-1">
            <h2
              id={titleId}
              ref={headingRef}
              tabIndex={-1}
              className="tt-focus m-0 font-tt-display text-tt-lg [font-weight:var(--tt-weight-display)] [word-break:keep-all]"
            >
              {view.title}
            </h2>
            {view.reason === null ? null : (
              <p className="m-0 text-tt-sm font-medium [overflow-wrap:anywhere] [word-break:keep-all]">{view.reason}</p>
            )}
            {view.productName === undefined ? null : (
              <p data-product-name="true" className="m-0 text-tt-sm [overflow-wrap:anywhere]">
                <span className="font-bold">상품</span> · {view.productName}
              </p>
            )}
          </div>
        </div>
        <JourneySpine spine={view.spine} />
        {view.notice === null ? null : <NoticeBanner notice={view.notice} variant="inline" />}
        <EtaDisplay eta={view.eta} />
        {children}
      </div>
    </section>
  );
}
