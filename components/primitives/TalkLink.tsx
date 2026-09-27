import type { ActionWeight, TalkPlacement } from "@/lib/tracking/types";
import { ButtonLink } from "./ButtonLink";

function TalkBubbleIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="1.125em"
      height="1.125em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className="shrink-0"
    >
      <path d="M4 5h16v11H10l-6 4z" />
    </svg>
  );
}

/**
 * The one 톡톡 link style (spec §8: at most 3 places per screen — header, one state place, footer).
 * Weight "text" is the usual one; "secondary" and "primary" (problem states only) use the same shape at more weight.
 * Always a new tab with the name `${label} 새 창으로 열기`; the speech bubble is left out in the compact header link.
 */
export function TalkLink({
  href,
  label,
  weight,
  placement
}: {
  readonly href: string;
  readonly label: string;
  readonly weight: ActionWeight;
  readonly placement: TalkPlacement;
}): React.JSX.Element {
  return (
    <ButtonLink href={href} variant={weight} external label={label} placement={placement}>
      {placement === "header" ? null : <TalkBubbleIcon />}
      <span>{label}</span>
    </ButtonLink>
  );
}
