import { expect, test } from "@playwright/test";
import {
  LOOKUP_CACHE_SECONDS,
  LOOKUP_TIMING,
  createLookupDeadline,
  withinMs
} from "@/lib/services/lookup-budget";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const reasonName = (signal: AbortSignal): string => {
  const reason: unknown = signal.reason;
  return typeof reason === "object" && reason !== null && "name" in reason && typeof reason.name === "string"
    ? reason.name
    : "none";
};

test("the request budget is 15 s and every fallback path fits inside it", () => {
  expect(LOOKUP_TIMING.budgetMs).toBe(15_000);
  expect(
    LOOKUP_TIMING.unipassCallMs + LOOKUP_TIMING.customstrackMs + LOOKUP_TIMING.responseMarginMs
  ).toBeLessThanOrEqual(LOOKUP_TIMING.budgetMs);
  expect(LOOKUP_TIMING.unipassCallMs + LOOKUP_TIMING.proxyMs + LOOKUP_TIMING.responseMarginMs).toBeLessThanOrEqual(
    LOOKUP_TIMING.budgetMs
  );
  expect(LOOKUP_TIMING.customsGraceAfterCarrierMs).toBeLessThanOrEqual(3_000);
});

test("NOT_FOUND is cached briefly and never longer than a real result", () => {
  expect(LOOKUP_CACHE_SECONDS.notFound).toBeGreaterThanOrEqual(60);
  expect(LOOKUP_CACHE_SECONDS.notFound).toBeLessThanOrEqual(300);
  expect(LOOKUP_CACHE_SECONDS.notFound).toBeLessThanOrEqual(LOOKUP_CACHE_SECONDS.pending);
  expect(LOOKUP_CACHE_SECONDS.pending).toBeLessThanOrEqual(LOOKUP_CACHE_SECONDS.result);
});

test("remaining time follows the injected clock", () => {
  let fakeNow = 1_000;
  const deadline = createLookupDeadline(10_000, () => fakeNow);
  try {
    expect(deadline.remainingMs()).toBe(10_000);
    fakeNow = 1_400;
    expect(deadline.elapsedMs()).toBe(400);
    expect(deadline.remainingMs()).toBe(9_600);
    fakeNow = 12_000;
    expect(deadline.remainingMs()).toBe(0);
  } finally {
    deadline.cancel();
  }
});

test("a call signal aborts after its cap with a TimeoutError", async () => {
  const deadline = createLookupDeadline(5_000);
  try {
    const signal = deadline.signal(50);
    expect(signal.aborted).toBe(false);
    await sleep(150);
    expect(signal.aborted).toBe(true);
    expect(reasonName(signal)).toBe("TimeoutError");
  } finally {
    deadline.cancel();
  }
});

test("a call signal never outlives the deadline", async () => {
  const deadline = createLookupDeadline(60);
  try {
    const signal = deadline.signal(10_000);
    await deadline.whenExpired();
    expect(signal.aborted).toBe(true);
    expect(deadline.remainingMs()).toBe(0);
  } finally {
    deadline.cancel();
  }
});

test("cancel aborts handed-out signals and ends the deadline", async () => {
  const deadline = createLookupDeadline(5_000);
  const signal = deadline.signal(4_000);
  deadline.cancel();
  await deadline.whenExpired();
  expect(signal.aborted).toBe(true);
  expect(reasonName(signal)).toBe("AbortError");
  expect(deadline.remainingMs()).toBe(0);
  deadline.cancel();
});

test("withinMs returns the value when it is fast and null when it is late", async () => {
  expect(await withinMs(Promise.resolve("fast"), 50)).toBe("fast");
  const late = new Promise<string>((resolve) => setTimeout(() => resolve("late"), 300));
  expect(await withinMs(late, 30)).toBeNull();
});
