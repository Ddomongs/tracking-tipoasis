"use client";

import { createPortal } from "react-dom";
import { ShareMenu } from "./ShareMenu";
import SoundToggle from "./SoundToggle";

/**
 * Header extras loaded as one small chunk shortly after the page settles (ThemeToggle): the share button in the header
 * (10월 4일 요청) and the sound switch on the scene's top-left corner — the header has no room for a fourth round
 * button on a 360 px phone, and the sound belongs with the scene. Neither changes '/' HTML or the first JavaScript.
 */
export default function HeaderExtras(): React.JSX.Element {
  const hero = document.querySelector<HTMLElement>("[data-site-hero]");
  return (
    <>
      <ShareMenu />
      {hero === null ? null : createPortal(<SoundToggle />, hero)}
    </>
  );
}
