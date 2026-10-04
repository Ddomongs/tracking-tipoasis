"use client";

import { Suspense, lazy, useSyncExternalStore } from "react";
import { useAnnounce } from "@/components/primitives/LiveAnnouncer";
import { applyStyleChoice, readAppliedStyle, subscribeAppliedStyle } from "@/lib/style/style-choice";
import { DARK_STYLE_ID, DEFAULT_STYLE_ID, STYLE_LABELS, type StyleId } from "@/lib/style/styles";

const TOGGLE_LABEL = "어두운 화면";
const BUTTON_CLASS =
  "tt-focus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-tt-control bg-tt-surface text-tt-ink";
// Sound on/off (10월 4일 요청 ③) loads as its own small chunk after hydration: '/' HTML and first JS stay as they were.
const SoundToggle = lazy(() => import("./SoundToggle"));

/** '/' is static: the server cannot know the style, so the button starts unpressed until hydration reads html[data-style]. */
function readServerStyle(): StyleId | null {
  return null;
}

function MoonIcon(): React.JSX.Element {
  return (
    <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M20,14.5A8,8,0,0,1,9.5,4A8,8,0,1,0,20,14.5z" />
    </svg>
  );
}

function SunIcon(): React.JSX.Element {
  return (
    <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  );
}

/**
 * The round day/night switch in the header (10월 2일 요청). It flips between 기본 and 어두운 화면 through the same style
 * choice module the internal gallery picker uses (html[data-style], localStorage tt:style; 10월 2일부터 the only public style switch) and announces the change the same way.
 */
export function ThemeToggle(): React.JSX.Element {
  const current = useSyncExternalStore<StyleId | null>(subscribeAppliedStyle, readAppliedStyle, readServerStyle);
  const announce = useAnnounce();
  const dark = current === DARK_STYLE_ID;

  const toggle = (): void => {
    const next: StyleId = dark ? DEFAULT_STYLE_ID : DARK_STYLE_ID;
    applyStyleChoice(next);
    announce(`화면 스타일을 ${STYLE_LABELS[next]}으로 바꿨어요`);
  };

  return (
    <>
      {current === null ? null : (
        <Suspense fallback={null}>
          <SoundToggle />
        </Suspense>
      )}
      <button type="button" aria-label={TOGGLE_LABEL} aria-pressed={dark} data-theme-toggle="true" onClick={toggle} className={BUTTON_CLASS}>
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>
    </>
  );
}
