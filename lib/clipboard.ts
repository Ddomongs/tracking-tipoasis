/**
 * Copy and share with in-app-browser fallbacks (spec §3 "공유", roadmap Review Focus 3). Browser only; never rejects.
 * copyText: Clipboard API → selection copy (older webviews) → "fallback" (the caller shows a read-only text box).
 */
export type CopyOutcome = "copied" | "fallback";
export type ShareOutcome = "shared" | "copied" | "fallback" | "dismissed";

async function writeWithClipboardApi(text: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      return false;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function copyWithSelection(text: string): boolean {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") return false;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  document.body.appendChild(area);
  try {
    area.focus({ preventScroll: true });
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}

export async function copyText(text: string): Promise<CopyOutcome> {
  if (await writeWithClipboardApi(text)) return "copied";
  return copyWithSelection(text) ? "copied" : "fallback";
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function canShare(data: ShareData): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  try {
    return typeof navigator.canShare !== "function" || navigator.canShare(data);
  } catch {
    return false;
  }
}

/** Share sheet first when `preferShare` (mobile); a dismissed sheet is not an error; anything else falls back to copying. */
export async function shareOrCopyLink(input: {
  readonly url: string;
  readonly title: string;
  readonly preferShare: boolean;
}): Promise<ShareOutcome> {
  const data: ShareData = { url: input.url, title: input.title };
  if (input.preferShare && canShare(data)) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (error) {
      if (isAbortError(error)) return "dismissed";
    }
  }
  return copyText(input.url);
}
