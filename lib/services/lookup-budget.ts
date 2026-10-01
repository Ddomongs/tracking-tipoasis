/**
 * Time and cache limits for one POST /api/track request (spec §16 item 5, release R4).
 * Server-only: imported by app/api/track/route.ts and lib/services/*.
 */

export const LOOKUP_TIMING = {
  /** Wall-clock budget of one request, response included (spec: 전체 예산 15초). */
  budgetMs: 15_000,
  /** Kept free inside the budget for normalizing and serializing the answer. */
  responseMarginMs: 500,
  /** One UNI-PASS call, headers and body together (same cap as the pre-R4 per-call timeout). */
  unipassCallMs: 8_000,
  /** customstrack fallback, headers and body together. */
  customstrackMs: 4_000,
  /** InsForge proxy call (removed with approval 12). */
  proxyMs: 5_000,
  /** DOMESTIC: once a carrier answered with events, wait at most this long for customs. */
  customsGraceAfterCarrierMs: 2_000
} as const;

/** Server cache lifetimes in seconds. NOT_FOUND stays short so a newly registered HBL shows up within minutes. */
export const LOOKUP_CACHE_SECONDS = {
  result: 900,
  pending: 300,
  notFound: 120
} as const;

export interface LookupDeadline {
  readonly budgetMs: number;
  readonly elapsedMs: () => number;
  readonly remainingMs: () => number;
  /** Aborts after min(capMs, remainingMs()), when the deadline ends, or on cancel(). */
  readonly signal: (capMs: number) => AbortSignal;
  /** Resolves when the deadline ends or cancel() runs. */
  readonly whenExpired: () => Promise<void>;
  /** Ends the deadline now: aborts every signal handed out and clears the timer. Safe to call twice. */
  readonly cancel: () => void;
}

const DEFAULT_DEADLINE_MS = LOOKUP_TIMING.budgetMs - LOOKUP_TIMING.responseMarginMs;

export function createLookupDeadline(
  budgetMs: number = DEFAULT_DEADLINE_MS,
  clock: () => number = Date.now
): LookupDeadline {
  const startedAt = clock();
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException("Lookup budget exhausted", "TimeoutError"));
  }, Math.max(0, budgetMs));
  const expired = new Promise<void>((resolve) => {
    controller.signal.addEventListener("abort", () => resolve(), { once: true });
  });
  const remainingMs = (): number =>
    controller.signal.aborted ? 0 : Math.max(0, budgetMs - (clock() - startedAt));

  return {
    budgetMs,
    elapsedMs: () => clock() - startedAt,
    remainingMs,
    signal: (capMs) =>
      AbortSignal.any([controller.signal, AbortSignal.timeout(Math.max(1, Math.min(capMs, remainingMs())))]),
    whenExpired: () => expired,
    cancel: () => {
      clearTimeout(timer);
      if (!controller.signal.aborted) controller.abort(new DOMException("Lookup finished", "AbortError"));
    }
  };
}

/** Resolves with the promise's value, or null when `ms` passes first. */
export async function withinMs<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), Math.max(0, ms));
  });
  try {
    return await Promise.race([promise, late]);
  } finally {
    clearTimeout(timer);
  }
}
