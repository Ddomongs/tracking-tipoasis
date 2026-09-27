"use client";

import { useState } from "react";
import { CopyButton } from "@/components/primitives/CopyButton";
import type { CopyOutcome } from "@/lib/clipboard";

/** Client island of the gallery: CopyButton demos that expose their outcome as data-copy-outcome for tests. */
export function UiKitInteractive({
  returnLink,
  inquiryText,
  talkUrl,
  talkLabel
}: {
  readonly returnLink: string;
  readonly inquiryText: string;
  readonly talkUrl: string;
  readonly talkLabel: string;
}): React.JSX.Element {
  const [copyOutcome, setCopyOutcome] = useState<CopyOutcome | "none">("none");
  const [talkOutcome, setTalkOutcome] = useState<CopyOutcome | "none">("none");
  return (
    <div className="flex flex-col gap-3">
      <div data-demo="copy" data-copy-text={returnLink} data-copy-outcome={copyOutcome} className="bg-tt-surface p-4">
        <CopyButton
          mode="copy"
          text={returnLink}
          label="다시 볼 링크 복사"
          copiedLabel="링크를 복사했어요"
          variant="secondary"
          onCopied={setCopyOutcome}
        />
      </div>
      <div data-demo="copy-and-open" data-copy-text={inquiryText} data-copy-outcome={talkOutcome} className="bg-tt-surface p-4">
        <CopyButton mode="copyAndOpen" text={inquiryText} label={talkLabel} href={talkUrl} variant="primary" onCopied={setTalkOutcome} />
      </div>
    </div>
  );
}
