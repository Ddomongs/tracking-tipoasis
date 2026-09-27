"use client";

import { useSyncExternalStore } from "react";
import { useAnnounce } from "@/components/primitives/LiveAnnouncer";
import { applyStyleChoice, readAppliedStyle, subscribeAppliedStyle } from "@/lib/style/style-choice";
import { STYLE_IDS, STYLE_LABELS, type StyleId } from "@/lib/style/styles";

/** Spec §13 literals: the group's name and the one sentence read after a change. */
const LEGEND = "화면 스타일";
const RADIO_NAME = "tt-style";

function announcementFor(id: StyleId): string {
  return `화면 스타일을 ${STYLE_LABELS[id]}으로 바꿨어요`;
}

/** '/' is static, so the server cannot know the customer's style: no radio is checked until hydration reads html[data-style]. */
function readServerStyle(): StyleId | null {
  return null;
}

/**
 * '화면 스타일' (spec §13): three radios right above the footer. A choice changes only html[data-style] — every component
 * keeps its DOM, hooks and copy — is remembered in this browser, and is announced once through the page's live region.
 */
export function StylePicker(): React.JSX.Element {
  const current = useSyncExternalStore<StyleId | null>(subscribeAppliedStyle, readAppliedStyle, readServerStyle);
  const announce = useAnnounce();

  const choose = (id: StyleId): void => {
    if (id === current) return;
    applyStyleChoice(id);
    announce(announcementFor(id));
  };

  return (
    <div className="border-t border-tt-rule bg-tt-surface text-tt-ink">
      <fieldset data-style-picker="true" className="mx-auto w-full max-w-[var(--tt-column)] border-0 px-[var(--tt-gutter)] py-4">
        <legend className="mb-2 p-0 text-tt-sm font-bold">{LEGEND}</legend>
        <div className="grid grid-cols-3 gap-2">
          {STYLE_IDS.map((id) => (
            <label
              key={id}
              className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 border border-tt-control px-2 text-tt-sm font-bold [word-break:keep-all] has-[:checked]:border-2 has-[:checked]:border-tt-ink"
            >
              <input
                type="radio"
                name={RADIO_NAME}
                value={id}
                checked={current === id}
                onChange={() => choose(id)}
                className="tt-focus m-0 h-5 w-5 shrink-0 accent-[var(--tt-primary)]"
              />
              <span>{STYLE_LABELS[id]}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
