"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/primitives/Button";
import { ButtonLink } from "@/components/primitives/ButtonLink";
import { NoticeBanner } from "@/components/primitives/NoticeBanner";
import type { LoadingViewModel } from "@/lib/tracking/types";

const SPIN_MS = 1000;
/** spinnerStopMs (5 s) ÷ SPIN_MS: at most five turns; after 5 s the model drops the spinner (spec §5, WCAG 2.2.2). */
const SPIN_TURNS = 5;
const SKELETON_STATIONS = [0, 1, 2, 3] as const;

/** Rotates the element a fixed number of turns. Never loops and never runs under reduced motion. */
function useFiniteSpin(active: boolean): React.RefObject<HTMLSpanElement | null> {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!active || element === null || typeof element.animate !== "function") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const animation = element.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], {
      duration: SPIN_MS,
      iterations: SPIN_TURNS,
      easing: "linear"
    });
    return () => animation.cancel();
  }, [active]);
  return ref;
}

export interface LoadingCardProps {
  readonly loading: LoadingViewModel;
  readonly onCancel: () => void;
}

/**
 * The status card while a lookup runs (spec §5, §7 loading): '조회하고 있어요' and the body, the 3 s / 8 s sentences,
 * '12초째', [조회 취소] from 3 s, the chosen carrier's official lookup from 8 s, and static skeletons as tall as the
 * result and at least as tall as the viewport under the header and number bar, so the result fills the same place
 * without a scroll jump or a layout shift below it. Renders every stage; the caller decides whether
 * the "instant" stage is shown. Never a live region: announcements go through the one LiveAnnouncer.
 */
export function LoadingCard({ loading, onCancel }: LoadingCardProps): React.JSX.Element {
  const titleId = useId();
  const spinnerRef = useFiniteSpin(loading.spinnerActive);
  const cancel = loading.cancel;
  const official = loading.carrierOfficial;
  return (
    <section
      data-loading-stage={loading.stage}
      data-guide-key="loading"
      data-ad-exclude="true"
      aria-busy="true"
      aria-labelledby={titleId}
      className="flex min-h-[calc(100svh_-_6.5rem)] min-w-0 flex-col gap-4"
    >
      <div data-slot="status-head" data-tone="neutral">
        <div className="flex items-start gap-3">
          {loading.spinnerActive ? (
            <span
              ref={spinnerRef}
              data-spinner="true"
              aria-hidden="true"
              className="mt-1 inline-block h-5 w-5 shrink-0 rounded-full border-[3px] border-solid border-current border-r-transparent"
            />
          ) : null}
          <div className="flex min-w-0 flex-col gap-1">
            <h2
              id={titleId}
              tabIndex={-1}
              className="tt-focus m-0 font-tt-display text-tt-lg [font-weight:var(--tt-weight-display)] [word-break:keep-all]"
            >
              {loading.title}
            </h2>
            <p className="m-0 text-tt-sm font-medium [word-break:keep-all]">{loading.body}</p>
          </div>
        </div>
        {loading.outageNotice === null ? null : <NoticeBanner notice={loading.outageNotice} variant="inline" />}
        {loading.extra === null ? null : (
          <p data-loading-extra="true" className="m-0 text-tt-sm font-bold [word-break:keep-all]">
            {loading.extra}
          </p>
        )}
        {loading.elapsedText === null ? null : (
          <p data-loading-elapsed="true" className="m-0 text-tt-sm [font-variant-numeric:tabular-nums]">
            {loading.elapsedText}
          </p>
        )}
        <div data-loading-skeleton="journey" aria-hidden="true" className="grid h-11 grid-cols-4 items-end gap-1">
          {SKELETON_STATIONS.map((station) => (
            <span key={station} className="h-2 border-2 border-solid border-current opacity-40" />
          ))}
        </div>
        <div data-loading-skeleton="eta" aria-hidden="true" className="h-16" />
        {cancel === null && official === null ? null : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {cancel === null ? null : (
              <Button variant={cancel.weight} onClick={onCancel}>
                {cancel.label}
              </Button>
            )}
            {official === null || official.href === null ? null : (
              <ButtonLink href={official.href} variant={official.weight} external label={official.label} />
            )}
          </div>
        )}
      </div>
      <div data-loading-skeleton="next-action" aria-hidden="true" className="min-h-[176px] bg-tt-surface" />
    </section>
  );
}
