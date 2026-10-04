/**
 * The customer's sound choice (10월 4일 요청 ③). Off unless they press the header button; kept in this browser only
 * (localStorage tt:sound), never sent anywhere. Storage that throws (private mode, blocked site data) reads as off.
 */
export const SOUND_STORAGE_KEY = "tt:sound";
const CHANGE_EVENT = "tt:sound";

export function readSoundOn(): boolean {
  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function writeSoundOn(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(SOUND_STORAGE_KEY, "on");
    else window.localStorage.removeItem(SOUND_STORAGE_KEY);
  } catch {
    // The choice then lasts only until the page closes.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeSound(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  }
}
