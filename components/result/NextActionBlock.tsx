import { AffiliateLinkGroup } from "@/components/primitives/AffiliateLinkGroup";
import { Button } from "@/components/primitives/Button";
import { TalkLink } from "@/components/primitives/TalkLink";
import type { ActionKind, ActionView, ResultAction, TrackingViewModel } from "@/lib/tracking/types";
import { ActionControl } from "./ActionControl";
import { openDetails } from "./details";

const TALK_KINDS: ReadonlySet<ActionKind> = new Set<ActionKind>(["talk", "copyAndTalk"]);


/** A text button in 지금 할 일 that opens one help item elsewhere in the result (pending purchase choices → 'order-check'). */
export interface HelpLink {
  /** DOM id of the help <details> (helpDetailsId). */
  readonly id: string;
  /** config help id, for the data-help-link hook. */
  readonly helpId: string;
  readonly label: string;
}

export interface NextActionBlockProps {
  readonly view: TrackingViewModel;
  readonly headingId: string;
  readonly onAction: (action: ResultAction) => void;
  readonly undeliveredHelpId: string | null;
  /** CarrierChooser for ambiguous results and carrier delays without an official link. */
  readonly carrierChooser?: React.ReactNode;
  /** Pending: '주문내역에서 확인' right after the purchase choices (approval 4). */
  readonly helpLink?: HelpLink | null;
}

/**
 * 지금 할 일 (spec §6): one sentence, at most one filled action, one or two secondary ones.
 * Store links lead only for delivered (spec §8 "스토어 선두") and follow 톡톡 for pending (purchase choices after the
 * disclosure). 톡톡 appears once: the worry line gets its own 톡톡 link only when no 톡톡 control is in the block.
 */
export function NextActionBlock({
  view,
  headingId,
  onAction,
  undeliveredHelpId,
  carrierChooser,
  helpLink
}: NextActionBlockProps): React.JSX.Element {
  const next = view.nextAction;
  const controls = [next.primary, ...next.secondary].filter((item): item is ActionView => item !== null);
  const hasTalk = controls.some((item) => TALK_KINDS.has(item.kind));
  const storesLead = next.stores !== null && next.stores.placement === "deliveredLead";
  const render = (item: ActionView): React.JSX.Element => (
    <ActionControl
      key={`${item.kind}:${item.label}`}
      action={item}
      onAction={onAction}
      inquiryCopy={view.inquiryCopy}
      returnLink={view.returnLink}
      undeliveredHelpId={undeliveredHelpId}
    />
  );
  return (
    <section
      data-cta-state={view.ctaState}
      aria-labelledby={next.heading === null ? undefined : headingId}
      className="flex min-w-0 flex-col gap-3 bg-tt-surface px-[var(--tt-gutter)] py-4 text-tt-ink"
    >
      {next.heading === null ? null : (
        <h3 id={headingId} className="m-0 font-tt-display text-tt-md [font-weight:var(--tt-weight-display)] [word-break:keep-all]">
          {next.heading}
        </h3>
      )}
      <p className="m-0 text-tt-md font-bold [word-break:keep-all]">{next.sentence}</p>
      {storesLead && next.stores !== null ? <AffiliateLinkGroup stores={next.stores} /> : null}
      {next.primary === null ? null : <div className="flex flex-col items-stretch">{render(next.primary)}</div>}
      {next.secondary.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{next.secondary.map(render)}</div>
      )}
      {next.worry === null ? null : (
        <p data-worry-line="true" className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-tt-sm [word-break:keep-all]">
          <span>{next.worry.text}</span>
          {hasTalk || next.worry.talk.href === null ? null : (
            <TalkLink href={next.worry.talk.href} label={next.worry.talk.label} weight="text" placement="state" />
          )}
        </p>
      )}
      {!storesLead && next.stores !== null ? <AffiliateLinkGroup stores={next.stores} /> : null}
      {helpLink === undefined || helpLink === null ? null : (
        <div>
          <Button variant="text" data-help-link={helpLink.helpId} aria-controls={helpLink.id} onClick={() => openDetails(helpLink.id)}>
            {helpLink.label}
          </Button>
        </div>
      )}
      {carrierChooser}
      {next.note === null ? null : (
        <p data-next-note="true" className="m-0 text-tt-sm text-tt-muted [word-break:keep-all]">
          {next.note}
        </p>
      )}
    </section>
  );
}
