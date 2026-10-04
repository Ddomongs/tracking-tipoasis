"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAnnounce } from "@/components/primitives/LiveAnnouncer";
import type { Cue } from "@/lib/sound/cues";
import { readSoundOn, subscribeSound, writeSoundOn } from "@/lib/sound/prefs";
import type { Tone } from "@/lib/tracking/types";

const SOUND_LABEL = "효과음";
const BUTTON_CLASS = "tt-focus inline-flex shrink-0 items-center justify-center rounded-full border";

/** The synthesizer loads only when a cue actually plays. */
function play(cue: Extract<Cue, "on"> | Tone): void {
  void import("@/lib/sound/cues").then((cues) => cues.playCue(cue === "on" ? "on" : cues.cueForTone(cue)));
}

function readServerSound(): boolean | null {
  return null;
}

function SoundIcon({ on }: { readonly on: boolean }): React.JSX.Element {
  return (
    <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M4,9H8L13,5V19L8,15H4Z" strokeLinejoin="round" />
      {on ? <path d="M16.5,9A4,4,0,0,1,16.5,15M19,6.5A7.5,7.5,0,0,1,19,17.5" /> : <path d="M17,9.5L22,14.5M22,9.5L17,14.5" />}
    </svg>
  );
}

/**
 * Sound on/off (10월 4일 요청 ③), off by default. HeaderExtras places it on the scene's top-left corner (app/globals.css).
 */
export default function SoundToggle(): React.JSX.Element | null {
  const on = useSyncExternalStore<boolean | null>(subscribeSound, readSoundOn, readServerSound);
  const announce = useAnnounce();
  // ResultSlot announces each lookup the customer started as 'tt:cue' with the result tone.
  useEffect(() => {
    if (on !== true) return undefined;
    const ring = (event: Event): void => {
      if (event instanceof CustomEvent && typeof event.detail === "string") play(event.detail as Tone);
    };
    window.addEventListener("tt:cue", ring);
    return () => window.removeEventListener("tt:cue", ring);
  }, [on]);
  if (on === null) return null;

  const toggle = (): void => {
    writeSoundOn(!on);
    announce(on ? "효과음을 껐어요" : "효과음을 켰어요");
    if (!on) play("on");
  };

  return (
    <button type="button" aria-label={SOUND_LABEL} aria-pressed={on} data-sound-toggle="true" onClick={toggle} className={BUTTON_CLASS}>
      <SoundIcon on={on} />
    </button>
  );
}

