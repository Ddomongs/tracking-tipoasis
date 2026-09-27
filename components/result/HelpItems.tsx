import type { HelpItemView } from "@/lib/tracking/types";

/** One help item as a <details> (open when the view says defaultOpen). Contains no links: 톡톡 stays in one place. */
export function HelpDetails({
  item,
  id,
  deliveredHelp = false
}: {
  readonly item: HelpItemView;
  readonly id?: string;
  readonly deliveredHelp?: boolean;
}): React.JSX.Element {
  return (
    <details
      id={id}
      data-help={item.id}
      data-delivered-help={deliveredHelp ? "true" : undefined}
      open={item.defaultOpen}
      className="bg-tt-surface px-[var(--tt-gutter)] text-tt-ink"
    >
      <summary className="tt-focus flex min-h-[44px] cursor-pointer items-center text-tt-sm font-bold [word-break:keep-all]">
        {item.summary}
      </summary>
      <div className="flex flex-col gap-1 pb-3">
        {item.body.map((line) => (
          <p key={line} className="m-0 text-tt-sm [overflow-wrap:anywhere] [word-break:keep-all]">
            {line}
          </p>
        ))}
      </div>
    </details>
  );
}

/** The DOM id of a help item's <details>, so a line elsewhere in the result can open it with openDetails(). */
export function helpDetailsId(prefix: string, helpId: string): string {
  return `${prefix}-help-${helpId}`;
}

/** The state's help items in config order (config/site.config.ts help[].showIn / openIn). */
export function HelpItems({
  items,
  idPrefix
}: {
  readonly items: readonly HelpItemView[];
  /** When set, every item gets the id helpDetailsId(idPrefix, item.id). */
  readonly idPrefix?: string;
}): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div data-help-list="true" className="flex flex-col gap-2">
      {items.map((item) => (
        <HelpDetails key={item.id} item={item} id={idPrefix === undefined ? undefined : helpDetailsId(idPrefix, item.id)} />
      ))}
    </div>
  );
}
