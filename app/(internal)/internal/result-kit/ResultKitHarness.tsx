"use client";

import { useEffect, useRef, useState } from "react";
import { ResultView } from "@/components/result/ResultView";
import type { FailureCause, ResultAction, TrackingViewModel } from "@/lib/tracking/types";

export type ResultKitScene = {
  readonly kind: "result";
  readonly view: TrackingViewModel;
  readonly frame?: "responsive" | "mobile";
  readonly readOnly?: boolean;
  readonly failureCause?: FailureCause;
  readonly withRecommendation?: boolean;
};

export interface ResultKitApi {
  readonly show: (scene: ResultKitScene) => void;
  readonly actions: () => readonly ResultAction[];
}

declare global {
  interface Window {
    __ttResultKit?: ResultKitApi;
  }
}

interface ShownScene {
  readonly scene: ResultKitScene;
  readonly serial: number;
}

/** Stand-in for the recommendation list (S08) so tests can check where the slot goes. */
function KitRecommendation({ context }: { readonly context: string }): React.JSX.Element {
  return (
    <section data-recommended-products={context} className="bg-tt-surface px-[var(--tt-gutter)] py-4 text-tt-sm text-tt-ink">
      추천 자리 (점검용)
    </section>
  );
}

/**
 * Tests call window.__ttResultKit.show(scene) with a view model derived in Node and read the reported ResultActions
 * with actions(). Each show() remounts the scene (fresh component state) and clears the action log.
 */
export function ResultKitHarness(): React.JSX.Element {
  const [shown, setShown] = useState<ShownScene | null>(null);
  const actionsRef = useRef<readonly ResultAction[]>([]);
  const rootRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    window.__ttResultKit = {
      show: (scene) => {
        actionsRef.current = [];
        setShown((previous) => ({ scene, serial: (previous?.serial ?? 0) + 1 }));
      },
      actions: () => actionsRef.current
    };
    rootRef.current?.setAttribute("data-result-kit", "ready");
    return () => {
      delete window.__ttResultKit;
    };
  }, []);

  const record = (action: ResultAction): void => {
    actionsRef.current = [...actionsRef.current, action];
  };

  const scene = shown === null ? null : shown.scene;
  const context = scene === null ? null : scene.view.revenue.recommendationContext;
  return (
    <main ref={rootRef} className="min-h-screen bg-tt-ground py-4 text-tt-ink">
      <h1 className="sr-only">결과 화면 점검</h1>
      {scene === null || shown === null ? null : (
        <ResultView
          key={shown.serial}
          view={scene.view}
          onAction={record}
          headingRef={headingRef}
          readOnly={scene.readOnly}
          frame={scene.frame}
          failureCause={scene.failureCause}
          recommendationSlot={
            scene.withRecommendation === true && context !== null ? <KitRecommendation context={context} /> : undefined
          }
        />
      )}
    </main>
  );
}
