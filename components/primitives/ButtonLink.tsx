import type { StorePlacementId, TalkPlacement } from "@/lib/tracking/types";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./Button";

const NEW_WINDOW_SUFFIX = " 새 창으로 열기";

type ButtonLinkProps = {
  readonly href: string;
  readonly variant: ButtonVariant;
  readonly size?: ButtonSize;
  /** New tab + accessible name `${label} 새 창으로 열기` + rel noopener noreferrer (roadmap §11.1 rule 7). */
  readonly external?: boolean;
  /** Affiliate link: rel gains "sponsored nofollow". */
  readonly sponsored?: boolean;
  readonly label: string;
  readonly placement?: TalkPlacement | StorePlacementId;
  /** A short, finite shine that draws the eye (10월 2일 요청; app/globals.css data-emphasis). */
  readonly emphasis?: boolean;
  readonly children?: React.ReactNode;
};

export function ButtonLink({
  href,
  variant,
  size = "md",
  external = false,
  sponsored = false,
  label,
  placement,
  emphasis = false,
  children
}: ButtonLinkProps): React.JSX.Element {
  const rel = [sponsored ? "sponsored nofollow" : null, external ? "noopener noreferrer" : null].filter(Boolean).join(" ");
  return (
    <a
      href={href}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-link-placement={placement}
      data-emphasis={emphasis ? "true" : undefined}
      target={external ? "_blank" : undefined}
      rel={rel || undefined}
      aria-label={external ? `${label}${NEW_WINDOW_SUFFIX}` : undefined}
      className={buttonClassName(variant, size)}
    >
      {children ?? label}
    </a>
  );
}
