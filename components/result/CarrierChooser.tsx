"use client";

import { useId, useRef } from "react";
import { buttonClassName } from "@/components/primitives/Button";
import type { CarrierChoiceView, ConcreteCarrierCode } from "@/lib/tracking/types";

const LEGEND = "택배사 선택";
/** A second activation of the same chip inside this window (double click, label + input click) is the same choice. */
const REPEAT_GUARD_MS = 600;

export interface CarrierChooserProps {
  readonly choices: readonly CarrierChoiceView[];
  readonly onChoose: (carrier: ConcreteCarrierCode) => void;
}

/**
 * fieldset '택배사 선택' with one 44 px radio chip per carrier (spec §7 ambiguous / lookupUnavailable, §12 "carriers as
 * fieldset + radio"). A pointer click chooses at once; the keyboard moves with the arrow keys and chooses with Space or
 * Enter, so arrowing through the group never starts a lookup (WCAG 3.2.2).
 */
export function CarrierChooser({ choices, onChoose }: CarrierChooserProps): React.JSX.Element {
  const name = useId();
  const lastChoiceRef = useRef<{ readonly code: ConcreteCarrierCode; readonly at: number } | null>(null);

  // `at` is the event's timeStamp: a clock read inside render scope would be impure for the React Compiler.
  const choose = (code: ConcreteCarrierCode, at: number): void => {
    const now = at;
    const last = lastChoiceRef.current;
    if (last !== null && last.code === code && now - last.at < REPEAT_GUARD_MS) return;
    lastChoiceRef.current = { code, at: now };
    onChoose(code);
  };

  return (
    <fieldset data-carrier-chooser="true" className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">{LEGEND}</legend>
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3">
        {choices.map((choice) => (
          <label
            key={choice.code}
            className={buttonClassName("secondary", "md", "cursor-pointer")}
            onClick={(event) => {
              // Pointer clicks carry detail ≥ 1; clicks the browser synthesizes for keyboard selection carry 0.
              if (event.detail > 0) choose(choice.code, event.timeStamp);
            }}
          >
            <input
              type="radio"
              name={name}
              value={choice.code}
              className="tt-focus m-0 h-5 w-5 shrink-0 accent-[var(--tt-ink)]"
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                choose(choice.code, event.timeStamp);
              }}
            />
            <span>{choice.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
