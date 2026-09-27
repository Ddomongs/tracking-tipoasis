"use client";

import { useEffect, useId, useRef, useState } from "react";
import { shareOrCopyLink } from "@/lib/clipboard";
import { buildReturnLink } from "@/lib/site";
import type { DeliveryCarrierCode } from "@/lib/types";

// Transitional: S07 replaces this with ReturnLinkAction and config copy. Renders no live region (S04 owns the only one).
const LABEL = "다시 볼 링크 복사";
const COPIED_LABEL = "링크를 복사했어요";
const SHARED_LABEL = "링크를 공유했어요";
const FALLBACK_HINT = "아래 링크를 길게 눌러 복사해 주세요.";
const SHARE_TITLE = "통관·배송 조회";
const LABEL_RESET_MS = 3000;

type ReturnLinkState = "idle" | "copied" | "shared" | "fallback";

function prefersShareSheet(): boolean {
  try {
    return typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

export function ReturnLinkButton({
  number,
  carrier
}: {
  readonly number: string;
  readonly carrier: DeliveryCarrierCode;
}): React.JSX.Element {
  const link = buildReturnLink(number, carrier);
  const [state, setState] = useState<ReturnLinkState>("idle");
  const fallbackId = useId();
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (state === "fallback") {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
      return;
    }
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), LABEL_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  const handleClick = async (): Promise<void> => {
    const outcome = await shareOrCopyLink({ url: link, title: SHARE_TITLE, preferShare: prefersShareSheet() });
    if (outcome !== "dismissed") setState(outcome);
  };

  const label = state === "copied" ? COPIED_LABEL : state === "shared" ? SHARED_LABEL : LABEL;

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => void handleClick()}
        className="inline-flex min-h-11 items-center rounded-xl border border-slate-600/80 bg-slate-900/40 px-4 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/60 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
      >
        {label}
      </button>
      {state === "fallback" ? (
        <div className="w-full max-w-md">
          <label htmlFor={fallbackId} className="block break-keep text-sm text-slate-300">
            {FALLBACK_HINT}
          </label>
          <textarea
            id={fallbackId}
            ref={fallbackRef}
            readOnly
            rows={2}
            value={link}
            data-copy-fallback="true"
            className="mt-1 w-full resize-none rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
          />
        </div>
      ) : null}
    </div>
  );
}
