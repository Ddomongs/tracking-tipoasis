import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "text";
export type ButtonSize = "md" | "lg";

const BASE_CLASS =
  "tt-focus inline-flex items-center justify-center gap-2 rounded-tt-button text-center font-tt-body text-tt-md font-bold transition-colors duration-tt-fast ease-tt [word-break:keep-all] aria-busy:cursor-progress";

const SHAPE_CLASS: Readonly<Record<ButtonVariant, Readonly<Record<ButtonSize, string>>>> = {
  primary: { md: "min-h-[44px] px-4", lg: "min-h-[52px] px-5" },
  secondary: { md: "min-h-[44px] px-4", lg: "min-h-[52px] px-5" },
  text: { md: "min-h-[44px] px-0", lg: "min-h-[52px] px-0" }
};

const VARIANT_CLASS: Readonly<Record<ButtonVariant, string>> = {
  primary: "border-0 bg-tt-primary text-tt-on-primary no-underline",
  secondary:
    "border-[length:var(--tt-border-button)] border-solid border-tt-ink bg-tt-surface text-tt-ink no-underline hover:bg-tt-ground",
  text: "border-0 bg-transparent text-tt-link underline decoration-2 underline-offset-[5px]"
};

/**
 * Class list of the `button` variant slot (corner/fill come from --tt-radius-button, --tt-border-button,
 * --tt-primary). Shared by Button, ButtonLink and CopyButton; later stages use it for other controls
 * that must look like buttons.
 */
export function buttonClassName(variant: ButtonVariant, size: ButtonSize, extra?: string): string {
  return [BASE_CLASS, SHAPE_CLASS[variant][size], VARIANT_CLASS[variant], extra].filter(Boolean).join(" ");
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant: ButtonVariant;
  /** md = 44px, lg = 52px (spec §12: actions 44–52px). */
  readonly size?: ButtonSize;
  /** Sets aria-busy. Never disables the button (spec §5). */
  readonly busy?: boolean;
};

export function Button({
  variant,
  size = "md",
  busy = false,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button
      {...rest}
      type={type}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={busy ? true : undefined}
      className={buttonClassName(variant, size, className)}
    >
      {children}
    </button>
  );
}
