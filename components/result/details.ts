/**
 * Opens a <details> element by id and moves focus to its summary ('수령이 안 됐다면 여기를 눌러 주세요', '전체 보기'). Browser only.
 * With `reveal`, the page glides so that part inside it (the call button of 미수령 안내, 10월 4일 요청) sits mid-screen;
 * under reduced motion it jumps.
 */
export function openDetails(id: string, reveal?: string): void {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLDetailsElement)) return;
  element.open = true;
  const summary = element.querySelector("summary");
  if (summary instanceof HTMLElement) summary.focus({ preventScroll: reveal !== undefined });
  if (reveal === undefined) return;
  const target = element.querySelector(reveal) ?? element;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
}
