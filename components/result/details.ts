/** Opens a <details> element by id and moves focus to its summary ('받지 못하셨나요?', '전체 보기'). Browser only. */
export function openDetails(id: string): void {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLDetailsElement)) return;
  element.open = true;
  const summary = element.querySelector("summary");
  if (summary instanceof HTMLElement) summary.focus();
}
