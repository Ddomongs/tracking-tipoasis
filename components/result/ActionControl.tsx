"use client";

import { useEffect, useState } from "react";
import { Button, type ButtonSize } from "@/components/primitives/Button";
import { ButtonLink } from "@/components/primitives/ButtonLink";
import { CallLink } from "./CallLink";
import { CopyButton } from "@/components/primitives/CopyButton";
import { TalkLink } from "@/components/primitives/TalkLink";
import { resultCopy } from "@/config/site.config";
import type { ActionView, ResultAction } from "@/lib/tracking/types";
import { openDetails } from "./details";
import { ReturnLinkAction } from "./ReturnLinkAction";

export interface ActionControlProps {
  readonly action: ActionView;
  readonly onAction: (action: ResultAction) => void;
  readonly inquiryCopy: string | null;
  readonly returnLink: string;
  /** id of the 미수령 안내 <details> (delivered), or null. */
  readonly undeliveredHelpId: string | null;
}

const ONE_SECOND_MS = 1000;

function sizeOf(action: ActionView): ButtonSize {
  return action.weight === "primary" ? "lg" : "md";
}

/** [다시 조회]: during a 429 countdown it stays focusable but inert (aria-disabled; never `disabled`, spec §5). */
function RetryControl({ action, onRetry }: { readonly action: ActionView; readonly onRetry: () => void }): React.JSX.Element {
  const cooldown = action.cooldownSeconds ?? 0;
  const [remaining, setRemaining] = useState(cooldown);
  // Counted from the start time, not by one timer per second: a throttled background tab (or a test clock that jumps)
  // still ends the countdown on time.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const left = Math.max(0, cooldown - Math.floor((performance.now() - startedAt) / ONE_SECOND_MS));
      setRemaining(left);
      if (left === 0) window.clearInterval(timer);
    }, ONE_SECOND_MS);
    return () => window.clearInterval(timer);
  }, [cooldown]);
  const waiting = remaining > 0;
  return (
    <Button
      variant={action.weight}
      size={sizeOf(action)}
      aria-disabled={waiting ? true : undefined}
      data-cooldown={waiting ? String(remaining) : undefined}
      onClick={() => {
        if (!waiting) onRetry();
      }}
    >
      {action.label}
    </Button>
  );
}

/** [문의 내용 복사하고 톡톡 열기]: copies and opens 톡톡 in one click, then shows exactly what was copied. */
function InquiryCopyAction({
  action,
  inquiryCopy,
  onAction
}: {
  readonly action: ActionView;
  readonly inquiryCopy: string | null;
  readonly onAction: (action: ResultAction) => void;
}): React.JSX.Element | null {
  if (action.href === null) return null;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <CopyButton
        mode="copyAndOpen"
        text={inquiryCopy ?? ""}
        label={action.label}
        href={action.href}
        variant={action.weight}
        onCopied={(outcome) => onAction({ kind: "copied", what: "inquiry", outcome })}
      />
      {inquiryCopy === null ? null : (
        <p
          data-inquiry-preview="true"
          className="m-0 border-0 border-l-4 border-solid border-tt-rule pl-3 font-tt-mono text-tt-xs text-tt-ink [overflow-wrap:anywhere]"
        >
          {inquiryCopy}
        </p>
      )}
    </div>
  );
}

/** One ActionView → the one control that performs it. Labels always come from the view (config copy). */
export function ActionControl({ action, onAction, inquiryCopy, returnLink, undeliveredHelpId }: ActionControlProps): React.JSX.Element | null {
  switch (action.kind) {
    case "talk":
      // The same click copies the inquiry text, so the customer only pastes it in 톡톡 (10월 4일 요청).
      return action.href === null ? null : (
        <TalkLink
          href={action.href}
          label={action.label}
          weight={action.weight}
          placement="state"
          onClick={
            inquiryCopy === null
              ? undefined
              : () => {
                  // The plain Clipboard API keeps lib/clipboard out of the shared first chunk ('/' HTML budget); if it is
                  // blocked, 톡톡 still opens and the customer types the question.
                  navigator.clipboard?.writeText(inquiryCopy).then(
                    () => onAction({ kind: "copied", what: "inquiry", outcome: "copied" }),
                    () => undefined
                  );
                }
          }
        />
      );
    case "copyAndTalk":
      return <InquiryCopyAction action={action} inquiryCopy={inquiryCopy} onAction={onAction} />;
    case "copyInquiry":
      return (
        <CopyButton
          mode="copy"
          text={inquiryCopy ?? ""}
          label={action.label}
          copiedLabel={resultCopy.inquiryCopied}
          variant={action.weight}
          onCopied={(outcome) => onAction({ kind: "copied", what: "inquiry", outcome })}
        />
      );
    case "fixNumber":
      return (
        <Button variant={action.weight} size={sizeOf(action)} onClick={() => onAction({ kind: "fixNumber" })}>
          {action.label}
        </Button>
      );
    case "retry":
      return <RetryControl action={action} onRetry={() => onAction({ kind: "retry" })} />;
    case "cancel":
      return (
        <Button variant={action.weight} size={sizeOf(action)} onClick={() => onAction({ kind: "cancel" })}>
          {action.label}
        </Button>
      );
    case "carrierOfficial":
      return action.href === null ? null : (
        <ButtonLink href={action.href} variant={action.weight} size={sizeOf(action)} external label={action.label} />
      );
    case "callDriver":
    case "callCarrier":
      return <CallLink action={action} size={sizeOf(action)} />;
    case "copyReturnLink":
      return <ReturnLinkAction action={action} link={returnLink} onAction={onAction} />;
    case "chooseCarrier":
      return null; // chips come from nextAction.carrierChoices (CarrierChooser)
    case "undeliveredHelp":
      return (
        <Button
          variant={action.weight}
          size={sizeOf(action)}
          aria-controls={undeliveredHelpId ?? undefined}
          data-emphasis="true"
          onClick={() => {
            if (undeliveredHelpId !== null) openDetails(undeliveredHelpId, "[data-delivered-contact]");
          }}
        >
          {action.label}
        </Button>
      );
  }
}
