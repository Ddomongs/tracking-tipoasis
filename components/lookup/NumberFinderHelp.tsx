/**
 * '번호는 어디서 찾나요?' (spec §4): 네이버 주문상세 → 배송조회, 쿠팡 주문목록 → 배송조회, 톡톡 출고 안내문.
 * Opens by itself on the INVALID screen (spec §7 "이 상태에서는 기본으로 펼침"); the key remounts it when that changes,
 * so the customer can still close it.
 */
export function NumberFinderHelp({
  summary,
  items,
  open
}: {
  readonly summary: string;
  readonly items: readonly string[];
  readonly open: boolean;
}): React.JSX.Element {
  return (
    <details key={open ? "open" : "closed"} open={open || undefined}>
      <summary className="tt-focus inline-flex min-h-[44px] cursor-pointer items-center whitespace-nowrap text-tt-sm font-bold text-tt-link underline decoration-2 underline-offset-4">
        {summary}
      </summary>
      <ul className="m-0 mb-2 list-disc pl-5 text-tt-sm text-tt-ink">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </details>
  );
}
