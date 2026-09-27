"use client";

import { useEffect, useId, useRef, useState } from "react";
import { actionClassName } from "@/components/status-slot/SlotParts";
import { copyText } from "@/lib/clipboard";
import type { CopyOutcome } from "@/lib/clipboard";
import type { ActionWeight } from "@/lib/tracking/types";

// Transitional (S07 uses S05's CopyButton mode "copyAndOpen"). One click copies the inquiry text and opens 톡톡 in a new tab. When the
// browser refuses the clipboard (in-app webviews), a read-only, pre-selected box shows the same text (roadmap Review Focus 3).
const FALLBACK_LABEL = "아래 문의 내용을 길게 눌러 복사해 주세요.";

export function CopyInquiryButton({
  label,
  href,
  text,
  weight,
  onCopied
}: {
  readonly label: string;
  readonly href: string;
  readonly text: string;
  readonly weight: ActionWeight;
  readonly onCopied?: (outcome: CopyOutcome) => void;
}): React.JSX.Element {
  const [outcome, setOutcome] = useState<CopyOutcome | null>(null);
  const boxId = useId();
  const boxRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (outcome !== "fallback") return;
    boxRef.current?.focus();
    boxRef.current?.select();
  }, [outcome]);

  return (
    <div className="w-full space-y-2">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label} 새 창으로 열기`}
        data-action-kind="copyAndTalk"
        data-action-weight={weight}
        className={actionClassName(weight)}
        onClick={() => {
          void copyText(text).then((result) => {
            setOutcome(result);
            onCopied?.(result);
          });
        }}
      >
        {label}
      </a>
      <p data-inquiry-preview="true" className="break-words font-mono text-xs leading-5 text-slate-600">
        {text}
      </p>
      {outcome === "fallback" ? (
        <div>
          <label htmlFor={boxId} className="block break-keep text-sm text-slate-700">
            {FALLBACK_LABEL}
          </label>
          <textarea
            id={boxId}
            ref={boxRef}
            readOnly
            rows={3}
            value={text}
            data-copy-fallback="true"
            className="mt-1 w-full resize-none rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          />
        </div>
      ) : null}
    </div>
  );
}
