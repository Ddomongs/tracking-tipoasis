"use client";

import { JourneySpine } from "@/components/primitives/JourneySpine";
import { NoticeBanner } from "@/components/primitives/NoticeBanner";
import { StatusChip } from "@/components/primitives/StatusChip";
import type { ActionKind, ActionView, FailureCause, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import { ActionControl } from "./ActionControl";
import { HelpItems } from "./HelpItems";

/** What the customer can do alone (spec §5, approval 3): these stay in the status card; the rest are inquiry steps. */
const RECOVERY_KINDS: ReadonlySet<ActionKind> = new Set<ActionKind>(["fixNumber", "retry"]);

export interface FailureCardProps {
  readonly view: TrackingViewModel;
  readonly titleId: string;
  readonly ctaHeadingId: string;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef?: React.Ref<HTMLHeadingElement>;
  readonly failureCause?: FailureCause;
}

/**
 * Error rows of spec §7: NOT_FOUND, 일시 지연 (429 countdown, 503/504, non-JSON), 오프라인, 응답 없음, SERVER_ERROR and
 * 계약 위반 — and the INVALID view for the CS preview. The status card carries the cause's recovery steps ([번호 수정],
 * [다시 조회]); the error block's first link is 톡톡 or [문의 내용 복사하고 톡톡 열기], and it holds no store link (spec §8).
 * Weights come from the view, so the approval-3 fallback is a config change only.
 */
export function FailureCard({ view, titleId, ctaHeadingId, onAction, headingRef, failureCause }: FailureCardProps): React.JSX.Element {
  const next = view.nextAction;
  const actions = [next.primary, ...next.secondary].filter((item): item is ActionView => item !== null);
  const recovery = actions.filter((item) => RECOVERY_KINDS.has(item.kind));
  const inquiry = actions.filter((item) => !RECOVERY_KINDS.has(item.kind));
  const line = view.auxiliaryLine;
  const render = (item: ActionView): React.JSX.Element => (
    <ActionControl
      key={`${item.kind}:${item.label}`}
      action={item}
      onAction={onAction}
      inquiryCopy={view.inquiryCopy}
      returnLink={view.returnLink}
      undeliveredHelpId={null}
    />
  );
  return (
    <section
      data-guide-key={view.guideKey}
      data-failure-cause={failureCause}
      data-overdue="false"
      data-tone={view.tone}
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-4"
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
            {view.reason === null ? null : <p className="m-0 text-tt-sm font-medium [word-break:keep-all]">{view.reason}</p>}
          </div>
        </div>
        {view.guideKey === "notFound" ? <JourneySpine spine={view.spine} /> : null}
        {view.notice === null ? null : <NoticeBanner notice={view.notice} variant="inline" />}
        {recovery.length === 0 ? null : (
          <div data-recovery="true" className="flex flex-wrap items-center gap-2">
            {recovery.map(render)}
          </div>
        )}
        {line === null ? null : (
          <p data-auxiliary-line="true" className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-tt-sm font-medium [word-break:keep-all]">
            <span>{line.text}</span>
            {line.action === null ? null : render(line.action)}
          </p>
        )}
      </div>
      <section
        data-cta-state="error"
        aria-labelledby={next.heading === null ? undefined : ctaHeadingId}
        className="flex min-w-0 flex-col gap-3 bg-tt-surface px-[var(--tt-gutter)] py-4 text-tt-ink"
      >
        {next.heading === null ? null : (
          <h3 id={ctaHeadingId} className="m-0 font-tt-display text-tt-md [font-weight:var(--tt-weight-display)] [word-break:keep-all]">
            {next.heading}
          </h3>
        )}
        <p className="m-0 text-tt-md font-bold [word-break:keep-all]">{next.sentence}</p>
        {inquiry.length === 0 ? null : <div className="flex flex-col items-start gap-2">{inquiry.map(render)}</div>}
        {next.worry === null ? null : (
          <p data-worry-line="true" className="m-0 text-tt-sm [word-break:keep-all]">
            {next.worry.text}
          </p>
        )}
      </section>
      <HelpItems items={view.help} />
      <div data-primary-end="true" aria-hidden="true" />
    </section>
  );
}
