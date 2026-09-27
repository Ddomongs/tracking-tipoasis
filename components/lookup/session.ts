/**
 * Per-document client snapshots of the lookup island, ported from S02's HomePageClient helpers.
 * Restore (spec §3): only in reload/back_forward documents, read once per document, and dropped as soon as any lookup
 * starts in this document, so an in-app return to '/' does not replay it. The server snapshot is null, so the static
 * '/' HTML and the first client render are identical (useSyncExternalStore renders the server snapshot while hydrating).
 */
import { currentNavigationKind, readRestoreEntry, type RestoreEntry } from "@/lib/privacy/session-restore";

let restoreSnapshot: RestoreEntry | null | undefined;
let restoreConsumed = false;

/** These snapshots never change on their own; nothing to subscribe to. */
export function subscribeToNothing(): () => void {
  return () => undefined;
}

export function getRestoreSnapshot(): RestoreEntry | null {
  if (restoreConsumed) return null;
  if (restoreSnapshot === undefined) {
    restoreSnapshot = readRestoreEntry({ now: Date.now(), navigation: currentNavigationKind() });
  }
  return restoreSnapshot;
}

export function getServerRestoreSnapshot(): RestoreEntry | null {
  return null;
}

export function markRestoreConsumed(): void {
  restoreConsumed = true;
}


/**
 * Same-address history entry (spec §3 뒤로가기; S02 Task 11 shipped it because the local-router regression passed):
 * after a manual lookup settles on '/', '/' is pushed once more so Back returns to the lookup form.
 */
export const LOOKUP_HISTORY_MARK = "ttLookup";

export function isLookupHistoryEntry(state: unknown): boolean {
  return typeof state === "object" && state !== null && LOOKUP_HISTORY_MARK in state;
}

export function pushLookupHistoryEntry(): void {
  const { pathname, search, hash } = window.location;
  if (pathname !== "/" || search !== "" || hash !== "") return;
  if (isLookupHistoryEntry(window.history.state)) return;
  window.history.pushState({ [LOOKUP_HISTORY_MARK]: true }, "", "/");
}


let clientNowMs: number | null = null;

/** The customer's clock, read once per document after hydration (the home notice is re-filtered with it). */
export function getClientNowSnapshot(): number | null {
  if (clientNowMs === null) clientNowMs = Date.now();
  return clientNowMs;
}

export function getServerNowSnapshot(): number | null {
  return null;
}

/** Dispatched by the header's site-name link while '/' shows a result: the island returns to an empty form. */
export const HOME_RESET_EVENT = "tt:home";
