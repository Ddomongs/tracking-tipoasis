"use client";

import { useEffect, useRef, type RefObject } from "react";
import { lookup as lookupConfig } from "@/config/site.config";
import { FormatHint } from "@/components/lookup/FormatHint";
import { INPUT_ASSIST_ID } from "@/components/lookup/InputAssist";
import { NumberFinderHelp } from "@/components/lookup/NumberFinderHelp";
import { Button } from "@/components/primitives/Button";
import { ToneIcon } from "@/components/primitives/ToneIcon";
import { CARRIER_NAMES, CONCRETE_CARRIER_CODES } from "@/lib/tracking/carriers";
import { parseCarrierParam } from "@/lib/tracking/number-input";
import type { DeliveryCarrierCode } from "@/lib/types";

export const TRACKING_INPUT_ID = "tracking-number";
export const FORMAT_HINT_ID = "tracking-format-help";
/** id of the invalid-number sentence (role="alert"); the value S04 gave it in TrackingForm, which S04's FailureNotice and E2E import (Addition 10). */
export const INVALID_NUMBER_ERROR_ID = "tracking-invalid-error";
const ERROR_ID = INVALID_NUMBER_ERROR_ID;
const DIAGNOSIS_ID = "tracking-number-diagnosis";
const CARRIER_ID = "tracking-carrier";
const INPUT_LABEL = "조회번호 (HBL 또는 운송장)";
const CARRIER_LABEL = "국내 택배사";
const AUTO_LABEL = "자동으로 찾기";

export interface InvalidInputView {
  readonly message: string;
  readonly diagnosis: string | null;
  readonly attempt: number;
}

export interface LookupFormProps {
  readonly value: string;
  readonly carrier: DeliveryCarrierCode;
  readonly busy: boolean;
  readonly invalid: InvalidInputView | null;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly onValueChange: (value: string) => void;
  readonly onCarrierChange: (carrier: DeliveryCarrierCode) => void;
  readonly onSubmit: () => void;
  /** Rendered right under the input (Task 6: paste notice, confusable question). */
  readonly assist: React.ReactNode;
  /** True while `assist` renders something; adds its id to aria-describedby. */
  readonly assistVisible: boolean;
  readonly onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => void;
}

/**
 * The lookup form (spec §4). It is also a plain GET form: without JavaScript it submits to '/?trackingNumber=…&c=…',
 * which next.config.ts redirects (307) to the deep-link shell (spec §3). Inputs are never disabled; busy → aria-busy.
 * No autofocus (the phone keyboard would cover the screen).
 */
export function LookupForm({
  value,
  carrier,
  busy,
  invalid,
  inputRef,
  onValueChange,
  onCarrierChange,
  onSubmit,
  assist,
  assistVisible,
  onPaste
}: LookupFormProps): React.JSX.Element {
  const carrierRef = useRef<HTMLSelectElement | null>(null);
  // A number typed or a carrier chosen while the scripts were still loading lives only in the DOM: adopt it, or the
  // lookup would silently use the empty value / "자동으로 찾기". Afterwards DOM and state agree and this is a no-op.
  useEffect(() => {
    const typed = inputRef.current?.value;
    if (typed !== undefined && typed !== value) onValueChange(typed);
    const chosen = carrierRef.current?.value;
    if (chosen !== undefined && chosen !== carrier) onCarrierChange(parseCarrierParam(chosen));
  }, [carrier, inputRef, onCarrierChange, onValueChange, value]);
  const describedBy = [FORMAT_HINT_ID, assistVisible ? INPUT_ASSIST_ID : null, invalid ? ERROR_ID : null, invalid?.diagnosis ? DIAGNOSIS_ID : null]
    .filter((id): id is string => id !== null)
    .join(" ");
  return (
    <form
      method="get"
      action="/"
      noValidate
      data-lookup-form="true"
      aria-busy={busy || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col px-[var(--tt-gutter)]"
    >
      <label htmlFor={TRACKING_INPUT_ID} className="text-tt-sm font-bold text-tt-ink">
        {INPUT_LABEL}
      </label>
      <input
        ref={inputRef}
        id={TRACKING_INPUT_ID}
        name="trackingNumber"
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onPaste={onPaste}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className={`tt-focus mt-1 h-14 w-full rounded-none border-[3px] bg-tt-surface px-4 font-tt-mono text-tt-lg tracking-[0.04em] text-tt-ink ${
          invalid ? "border-tt-attention-ink" : "border-tt-ink"
        }`}
      />
      {assist}
      {invalid ? (
        <div data-guide-key="invalidNumber" className="mt-2 flex flex-col gap-1">
          <p
            key={invalid.attempt}
            id={ERROR_ID}
            role="alert"
            className="m-0 flex items-start gap-1.5 text-tt-sm font-bold text-tt-attention-ink [word-break:keep-all]"
          >
            <ToneIcon tone="attention" />
            <span>{invalid.message}</span>
          </p>
          {invalid.diagnosis ? (
            <p id={DIAGNOSIS_ID} className="m-0 text-tt-sm text-tt-ink [word-break:keep-all]">
              {invalid.diagnosis}
            </p>
          ) : null}
        </div>
      ) : null}
      <FormatHint id={FORMAT_HINT_ID} text={lookupConfig.copy.formatHint} />
      {/* 10월 2일 요청: '번호는 어디서 찾나요?' and a compact carrier picker share one row (the first view ends higher on
          phones); an opened help list takes the whole row and the picker wraps below it. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 [&:has(details[open])]:basis-full">
          <NumberFinderHelp
            summary={lookupConfig.copy.numberFinderSummary}
            items={lookupConfig.copy.numberFinderItems}
            open={invalid !== null}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label htmlFor={CARRIER_ID} className="sr-only whitespace-nowrap text-tt-xs font-bold text-tt-muted min-[480px]:not-sr-only">
            {CARRIER_LABEL}
          </label>
          <div className="relative">
            <select
              id={CARRIER_ID}
              ref={carrierRef}
              name="c"
              value={carrier}
              onChange={(event) => onCarrierChange(parseCarrierParam(event.target.value))}
              className="tt-focus block h-11 w-[8.5rem] appearance-none rounded-none border-2 border-tt-ink bg-tt-surface pl-3 pr-8 text-tt-sm font-medium text-tt-ink"
            >
              <option value="AUTO">{AUTO_LABEL}</option>
              {CONCRETE_CARRIER_CODES.map((code) => (
                <option key={code} value={code}>
                  {CARRIER_NAMES[code]}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              focusable="false"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="square"
              strokeLinejoin="miter"
              className="pointer-events-none absolute right-2.5 top-[15px] text-tt-ink"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>
      <Button type="submit" variant="primary" size="lg" busy={busy} data-emphasis="true" className="mt-3 w-full">
        {busy ? lookupConfig.copy.submitting : lookupConfig.copy.submit}
      </Button>
    </form>
  );
}
