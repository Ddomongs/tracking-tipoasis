/** Opens a <details> element by id and moves focus to its summary ('수령이 안 됐다면 여기를 눌러 주세요', '전체 보기'). Browser only. */
export function openDetails(id: string): void {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLDetailsElement)) return;
  element.open = true;
  const summary = element.querySelector("summary");
  if (summary instanceof HTMLElement) summary.focus();
}
