import { DEFAULT_STYLE_ID, STYLE_STORAGE_KEY, isStyleId, type StyleId } from "@/lib/style/styles";

/**
 * The customer's screen-style choice in the browser (spec §13 "화면 스타일 선택"). The pre-paint script (lib/style/prepaint.ts)
 * applied the stored or first-visit style before hydration; this module reads that attribute, applies later choices at
 * once and remembers them in this browser only (localStorage tt:style — never sent anywhere). Browser only.
 */
type StyleStorage = Pick<Storage, "setItem">;

const listeners = new Set<() => void>();

export function readAppliedStyle(): StyleId {
  const value = document.documentElement.getAttribute("data-style");
  return isStyleId(value) ? value : DEFAULT_STYLE_ID;
}

export function subscribeAppliedStyle(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function browserStorage(): StyleStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Applies the style at once; a blocked storage (in-app browsers, private windows) only means the choice lasts for this page. */
export function applyStyleChoice(id: StyleId, storage: StyleStorage | null = browserStorage()): void {
  document.documentElement.setAttribute("data-style", id);
  try {
    storage?.setItem(STYLE_STORAGE_KEY, id);
  } catch {
    // Storage refused the write: the style still applies until the page is left.
  }
  listeners.forEach((listener) => listener());
}
