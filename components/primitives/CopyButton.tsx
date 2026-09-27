"use client";

import { useEffect, useRef, useState } from "react";
import { copyText, type CopyOutcome } from "@/lib/clipboard";
import { Button, buttonClassName, type ButtonVariant } from "./Button";

const NEW_WINDOW_SUFFIX = " 새 창으로 열기";

interface CopyButtonBase {
  readonly text: string;
  readonly label: string;
  readonly variant: ButtonVariant;
  readonly onCopied?: (outcome: CopyOutcome) => void;
}

export type CopyButtonProps =
  | (CopyButtonBase & { readonly mode: "copy"; readonly copiedLabel: string })
  | (CopyButtonBase & { readonly mode: "copyAndOpen"; readonly href: string });

interface CopyResult {
  readonly text: string;
  readonly outcome: CopyOutcome;
}

function startCopy(text: string): Promise<CopyOutcome> {
  try {
    return copyText(text).catch((): CopyOutcome => "fallback");
  } catch {
    return Promise.resolve("fallback");
  }
}

/**
 * Copies `text` (roadmap §11.9). "copy" is a button; "copyAndOpen" is a new-tab link that copies in the same
 * click, so the popup blocker and the clipboard's user-activation rule both see one gesture. When the clipboard
 * is blocked (Naver/Kakao in-app browsers) a read-only textarea with the whole text selected appears below the
 * control. It never throws. Announcing the result is the caller's job (onCopied → useAnnounce); no live region here.
 */
export function CopyButton(props: CopyButtonProps): React.JSX.Element {
  const { text, label, variant, onCopied } = props;
  const [result, setResult] = useState<CopyResult | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  // A result belongs to the text it copied; a new text starts fresh without an effect.
  const outcome = result !== null && result.text === text ? result.outcome : null;

  useEffect(() => {
    if (outcome !== "fallback") return;
    const box = fallbackRef.current;
    if (box === null) return;
    box.focus();
    box.select();
    // iOS webviews ignore select() on a read-only field; an explicit range selects the whole text there too.
    box.setSelectionRange(0, box.value.length);
  }, [outcome]);

  const copy = (): void => {
    void startCopy(text).then((next) => {
      setResult({ text, outcome: next });
      onCopied?.(next);
    });
  };

  const trigger =
    props.mode === "copy" ? (
      <Button variant={variant} onClick={copy}>
        {outcome === "copied" ? props.copiedLabel : label}
      </Button>
    ) : (
      <a
        href={props.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label}${NEW_WINDOW_SUFFIX}`}
        data-slot="button"
        data-variant={variant}
        data-size="md"
        className={buttonClassName(variant, "md")}
        onClick={copy}
      >
        {label}
      </a>
    );

  return (
    <div className="flex w-full max-w-full flex-col items-start gap-2">
      {trigger}
      {outcome === "fallback" ? (
        <textarea
          ref={fallbackRef}
          readOnly
          value={text}
          aria-label={label}
          data-copy-fallback="true"
          rows={3}
          onFocus={(event) => event.currentTarget.select()}
          className="tt-focus block w-full min-w-0 resize-none border-2 border-solid border-tt-ink bg-tt-surface p-3 font-tt-body text-tt-md text-tt-ink"
        />
      ) : null}
    </div>
  );
}
