/** True when the customer already scrolled or moved focus before the interaction listeners were attached. */
export function interactedBeforeHydration(): boolean {
  return window.scrollY > 0 || (document.activeElement !== null && document.activeElement !== document.body);
}

/**
 * The browser records the first press or tap even before hydration and reports it a moment later (buffered); listeners
 * attached after hydration would miss it (S06 ruling, S04 deferred minor). Returns the cleanup, or null where the entry
 * type is unknown (Safari: focus then follows the default rule).
 */
export function watchFirstInput(onInput: () => void): (() => void) | null {
  if (typeof PerformanceObserver === "undefined" || !PerformanceObserver.supportedEntryTypes.includes("first-input")) return null;
  const observer = new PerformanceObserver(onInput);
  observer.observe({ type: "first-input", buffered: true });
  return () => observer.disconnect();
}
