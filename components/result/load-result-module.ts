/** Initial-bundle loader of the lazy result chunk (roadmap §11.9). Never imports result-module.ts statically. */
export type ResultModule = typeof import("./result-module");

let pending: Promise<ResultModule> | null = null;

/** Memoized dynamic import. A failed import is forgotten, so the next call (the next lookup) tries again. */
export function loadResultModule(): Promise<ResultModule> {
  if (pending === null) {
    pending = import("./result-module").catch((error: unknown) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

/** Starts the download early (submit, deep-link start, focus in the lookup form). Never throws. */
export function preloadResultModule(): void {
  loadResultModule().catch(() => undefined);
}
