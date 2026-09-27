/** The non-clickable format line under the input (spec §4 "예시 대신 형식 안내"). Real numbers never appear here. */
export function FormatHint({ id, text }: { readonly id: string; readonly text: string }): React.JSX.Element {
  return (
    <p id={id} className="m-0 mt-1.5 text-tt-xs text-tt-muted [word-break:keep-all]">
      {text}
    </p>
  );
}
