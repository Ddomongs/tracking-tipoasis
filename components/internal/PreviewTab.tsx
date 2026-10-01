"use client";

import { useMemo } from "react";
import { deriveResultView } from "@/components/result/approvals";
import { siteConfig } from "@/config/site.config";
import { buildCsReply, type CsReply } from "@/lib/cs/cs-reply";
import { buildPreviewScenarios, type PreviewScenario } from "@/lib/cs/preview-outcomes";
import { formatKstDateTime } from "@/lib/tracking/time";
import type { FailureCause, TrackingViewModel } from "@/lib/tracking/types";
import { ScreenAndReply } from "./ScreenAndReply";
import { HELP_CLASS, PANEL_CLASS, SECTION_TITLE_CLASS } from "./ui";

const PREPARING = "미리보기를 준비하고 있어요.";
const INTRO =
  "모든 상태를 가짜 번호(0000 0000 0001, TEST 0000 0001)로 보여 줍니다. 설정을 고친 뒤 배포 전에 고객 화면과 CS 답변을 여기서 확인하세요.";

interface PreviewItem {
  readonly scenario: PreviewScenario;
  readonly view: TrackingViewModel;
  readonly reply: CsReply;
  readonly failureCause: FailureCause | undefined;
}

/** The customer page's own view for each fake scenario at `now`, and the CS replies built from it. */
function previewItems(now: Date): readonly PreviewItem[] {
  return buildPreviewScenarios(now).map((scenario) => {
    const view = deriveResultView(scenario.outcome, now);
    return {
      scenario,
      view,
      reply: buildCsReply(view, { now, notices: siteConfig.notices }),
      failureCause: scenario.outcome.kind === "failure" ? scenario.outcome.cause : undefined
    };
  });
}

/** 안내표 미리보기 (spec §10 ③): every state with fake numbers — the customer's screen next to the CS replies. */
export function PreviewTab({ now }: { readonly now: Date | null }): React.JSX.Element {
  const items = useMemo(() => (now === null ? [] : previewItems(now)), [now]);
  if (now === null) return <p className={HELP_CLASS}>{PREPARING}</p>;
  return (
    <div className="flex flex-col gap-4">
      <div className={PANEL_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>안내표 미리보기</h2>
        <p className={HELP_CLASS}>{INTRO}</p>
        <p className={HELP_CLASS}>{`기준 시각 ${formatKstDateTime(now)} (한국 시간)`}</p>
        <nav aria-label="상태 바로가기">
          <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
            {items.map(({ scenario }) => (
              <li key={scenario.id}>
                <a href={`#preview-${scenario.id}`} className="tt-focus inline-flex min-h-[24px] items-center text-tt-sm text-tt-link underline">
                  {scenario.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      {items.map(({ scenario, view, reply, failureCause }) => (
        <section
          key={scenario.id}
          id={`preview-${scenario.id}`}
          aria-labelledby={`preview-${scenario.id}-title`}
          data-preview-scenario={scenario.id}
          className={PANEL_CLASS}
        >
          <h2 id={`preview-${scenario.id}-title`} className={SECTION_TITLE_CLASS}>
            {scenario.label}
          </h2>
          <ScreenAndReply view={view} reply={reply} failureCause={failureCause} />
        </section>
      ))}
    </div>
  );
}
