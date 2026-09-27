import type { Tone } from "@/lib/tracking/types";
import { ToneIcon } from "./ToneIcon";

/** Status chip, e.g. '통관 대기 · 2/4'. Colors come from app/styles/tokens.css ([data-status-chip][data-tone]). */
export function StatusChip({ tone, text }: { readonly tone: Tone; readonly text: string }): React.JSX.Element {
  return (
    <span data-status-chip="true" data-tone={tone}>
      <ToneIcon tone={tone} />
      <span>{text}</span>
    </span>
  );
}
