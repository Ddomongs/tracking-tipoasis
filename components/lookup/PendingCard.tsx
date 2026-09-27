/**
 * The static '조회하고 있어요' card (spec §7 loading): what a deep link paints from the server HTML, and what any
 * non-manual lookup shows in its first 0.4 s. Static skeleton blocks, no shimmer, no spinner (spec §5, §12 2.2.2).
 */
export function PendingCard({ title, body }: { readonly title: string; readonly body: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 px-[var(--tt-gutter)] pt-2">
      <h2 className="m-0 text-tt-lg font-black text-tt-ink">{title}</h2>
      <p className="m-0 text-tt-sm text-tt-ink [word-break:keep-all]">{body}</p>
      <div aria-hidden="true" className="mt-2 flex flex-col gap-3">
        <div className="h-14 bg-tt-ground" />
        <div className="h-10 w-2/3 bg-tt-ground" />
        <div className="h-24 bg-tt-ground" />
      </div>
    </div>
  );
}
