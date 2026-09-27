"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/primitives/Button";
import { resultCopy, stateGuide } from "@/config/site.config";
import { shareOrCopyLink, type ShareOutcome } from "@/lib/clipboard";
import type { ActionView, ResultAction } from "@/lib/tracking/types";

const LABEL_RESET_MS = 3000;

type ReturnLinkState = "idle" | "copied" | "shared" | "fallback";

function prefersShareSheet(): boolean {
  try {
    return typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

function stateAfter(outcome: ShareOutcome): ReturnLinkState | null {
  switch (outcome) {
    case "copied":
      return "copied";
    case "shared":
      return "shared";
    case "fallback":
      return "fallback";
    case "dismissed":
      return null;
  }
}

export interface ReturnLinkActionProps {
  readonly action: ActionView;
  readonly link: string;
  readonly onAction: (action: ResultAction) => void;
}

/**
 * [다시 볼 링크 복사] (spec §3 공유): the share sheet first on touch screens, otherwise the clipboard; when both are
 * blocked (in-app browsers) a read-only box with the link appears, focused and fully selected. Keeps S02's behavior.
 */
export function ReturnLinkAction({ action, link, onAction }: ReturnLinkActionProps): React.JSX.Element {
  const [state, setState] = useState<ReturnLinkState>("idle");
  const fallbackId = useId();
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (state === "fallback") {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
      return undefined;
    }
    if (state === "idle") return undefined;
    const timer = window.setTimeout(() => setState("idle"), LABEL_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  const handleClick = (): void => {
    void shareOrCopyLink({ url: link, title: stateGuide.idle.docTitle, preferShare: prefersShareSheet() }).then((outcome) => {
      const next = stateAfter(outcome);
      if (next === null) return;
      setState(next);
      if (outcome === "copied" || outcome === "fallback") onAction({ kind: "copied", what: "returnLink", outcome });
    });
  };

  const label = state === "copied" ? resultCopy.returnLinkCopied : state === "shared" ? resultCopy.returnLinkShared : action.label;
  return (
    <div className="flex max-w-full flex-col items-start gap-2">
      <Button variant={action.weight} size="md" onClick={handleClick}>
        {label}
      </Button>
      {state === "fallback" ? (
        <div className="flex w-full flex-col gap-1">
          <label htmlFor={fallbackId} className="text-tt-sm [word-break:keep-all]">
            {resultCopy.returnLinkFallback}
          </label>
          <textarea
            id={fallbackId}
            ref={fallbackRef}
            readOnly
            rows={2}
            value={link}
            data-copy-fallback="true"
            className="tt-focus block w-full min-w-0 resize-none border-2 border-solid border-tt-ink bg-tt-surface p-2 font-tt-mono text-tt-sm text-tt-ink [overflow-wrap:anywhere]"
          />
        </div>
      ) : null}
    </div>
  );
}
