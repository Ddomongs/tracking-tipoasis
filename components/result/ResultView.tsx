"use client";

import { useId } from "react";
import { channels } from "@/config/site.config";
import type { FailureCause, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import { ActionControl } from "./ActionControl";
import { CarrierChooser } from "./CarrierChooser";
import { NextActionBlock } from "./NextActionBlock";
import { StatusCard } from "./StatusCard";

export interface ResultViewProps {
  readonly view: TrackingViewModel;
  readonly onAction: (action: ResultAction) => void;
  readonly headingRef?: React.Ref<HTMLHeadingElement>;
  /** Placed per view.revenue.recommendations and guideKey; never between the fixed-order blocks. */
  readonly recommendationSlot?: React.ReactNode;
  /** CS preview: actions inert, no focus moves. */
  readonly readOnly?: boolean;
  /** "mobile" forces the 375 px single column (CS preview). */
  readonly frame?: "responsive" | "mobile";
  /** S07 addition: the cause behind an error view, for data-failure-cause on the failure card. */
  readonly failureCause?: FailureCause;
}

type ExternalTarget = Extract<ResultAction, { kind: "openedExternal" }>["target"];

/** Which outside place a result link opens (reported for analytics, S11). */
function externalTarget(anchor: HTMLAnchorElement): ExternalTarget | null {
  const href = anchor.getAttribute("href") ?? "";
  if (href.startsWith("tel:")) return "driver";
  if (anchor.target !== "_blank") return null;
  if (href === channels.talk.url) return "talk";
  if (anchor.closest("[data-affiliate-group], [data-recommended-products]") !== null) return "store";
  return "carrier";
}

function reportExternal(event: React.MouseEvent<HTMLElement>, onAction: (action: ResultAction) => void): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return;
  const kind = externalTarget(anchor);
  if (kind !== null) onAction({ kind: "openedExternal", target: kind });
}

/**
 * The result area (spec §6–§7), loaded lazily through result-module.ts. It renders only the view model, in the fixed
 * order 상태 카드 → 도착 예상 → 지금 할 일 → 마지막 처리 → 처리 내역. The number bar above it belongs to the caller.
 */
export function ResultView({ view, onAction, headingRef, readOnly = false, frame = "responsive" }: ResultViewProps): React.JSX.Element {
  const baseId = useId();
  const auxiliary = view.auxiliaryLine;
  return (
    <div
      data-result-view={view.mode}
      data-ad-exclude="true"
      data-frame={frame}
      data-read-only={readOnly ? "true" : undefined}
      onClick={(event) => reportExternal(event, onAction)}
      className="mx-auto flex w-full flex-col gap-4"
    >
      <div data-result-main="true" className="flex min-w-0 flex-col gap-4">
        <StatusCard view={view} titleId={`${baseId}-title`} headingRef={headingRef}>
          {auxiliary === null ? null : (
            <p data-auxiliary-line="true" className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-tt-sm font-medium [word-break:keep-all]">
              <span>{auxiliary.text}</span>
              {auxiliary.action === null ? null : (
                <ActionControl
                  action={auxiliary.action}
                  onAction={onAction}
                  inquiryCopy={view.inquiryCopy}
                  returnLink={view.returnLink}
                  undeliveredHelpId={null}
                />
              )}
            </p>
          )}
        </StatusCard>
        <NextActionBlock
          view={view}
          headingId={`${baseId}-next`}
          onAction={onAction}
          undeliveredHelpId={null}
          carrierChooser={
            view.nextAction.carrierChoices === null ? undefined : (
              <CarrierChooser
                choices={view.nextAction.carrierChoices}
                onChoose={(carrier) => onAction({ kind: "chooseCarrier", carrier })}
              />
            )
          }
        />
      </div>
    </div>
  );
}
