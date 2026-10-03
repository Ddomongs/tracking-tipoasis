import { ButtonLink } from "@/components/primitives/ButtonLink";
import type { ActionView } from "@/lib/tracking/types";

function PhoneIcon(): React.JSX.Element {
  return (
    <svg aria-hidden="true" focusable="false" width="1.125em" height="1.125em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" className="shrink-0">
      <path d="M5,3H9L11,8L8.5,9.5A11,11,0,0,0,14.5,15.5L16,13L21,15V19A2,2,0,0,1,19,21A16,16,0,0,1,3,5A2,2,0,0,1,5,3Z" />
    </svg>
  );
}

/** A tel: link that shows whom it calls and the (masked) number on the button (10월 2일 요청). */
export function CallLink({ action, size = "md" }: { readonly action: ActionView; readonly size?: "md" | "lg" }): React.JSX.Element | null {
  if (action.href === null) return null;
  return (
    <ButtonLink href={action.href} variant={action.weight} size={size} label={action.label}>
      <PhoneIcon />
      <span>{action.label}</span>
      {action.detail === undefined ? null : (
        <span data-call-detail="true" className="font-tt-mono text-tt-sm font-medium [font-variant-numeric:tabular-nums]">
          {action.detail}
        </span>
      )}
    </ButtonLink>
  );
}
