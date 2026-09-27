"use client";

import type { RefObject } from "react";
import { lookup as lookupConfig } from "@/config/site.config";
import { FormatHint } from "@/components/lookup/FormatHint";
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
  onSubmit
}: LookupFormProps): React.JSX.Element {
  const describedBy = [FORMAT_HINT_ID, invalid ? ERROR_ID : null, invalid?.diagnosis ? DIAGNOSIS_ID : null]
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
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className={`tt-focus mt-1 h-14 w-full rounded-none border-[3px] bg-tt-surface px-4 font-tt-mono text-tt-lg tracking-[0.04em] text-tt-ink ${
          invalid ? "border-tt-attention-ink" : "border-tt-ink"
        }`}
      />
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
      <NumberFinderHelp
        summary={lookupConfig.copy.numberFinderSummary}
        items={lookupConfig.copy.numberFinderItems}
        open={invalid !== null}
      />
      <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-2">
        <label htmlFor={CARRIER_ID} className="whitespace-nowrap text-tt-sm font-bold text-tt-ink">
          {CARRIER_LABEL}
        </label>
        <div className="relative">
          <select
            id={CARRIER_ID}
            name="c"
            value={carrier}
            onChange={(event) => onCarrierChange(parseCarrierParam(event.target.value))}
            className="tt-focus block h-12 w-full appearance-none rounded-none border-2 border-tt-ink bg-tt-surface pl-3.5 pr-10 text-tt-md font-medium text-tt-ink"
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
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="square"
            strokeLinejoin="miter"
            className="pointer-events-none absolute right-3.5 top-4 text-tt-ink"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>
      <Button type="submit" variant="primary" size="lg" busy={busy} className="mt-3 w-full">
        {busy ? lookupConfig.copy.submitting : lookupConfig.copy.submit}
      </Button>
    </form>
  );
}
