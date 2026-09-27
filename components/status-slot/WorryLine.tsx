import { actionClassName } from "@/components/status-slot/SlotParts";
import type { WorryLineView } from "@/lib/tracking/types";

// Transitional (deleted by S07). The worry date bound to a 톡톡 text link (spec §6 지금 할 일). `showTalk` is false when the block
// already has 톡톡 as its filled primary, so each block carries one plain 톡톡 link.

export function WorryLine({ worry, showTalk }: { readonly worry: WorryLineView; readonly showTalk: boolean }): React.JSX.Element {
  return (
    <p data-worry-line="true" className="flex flex-wrap items-center gap-x-3 gap-y-1 break-keep text-sm leading-6 text-slate-800">
      <span>{worry.text}</span>
      {showTalk && worry.talk.href !== null ? (
        <a
          href={worry.talk.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${worry.talk.label} 새 창으로 열기`}
          data-action-kind={worry.talk.kind}
          data-action-weight={worry.talk.weight}
          className={actionClassName(worry.talk.weight)}
        >
          {worry.talk.label}
        </a>
      ) : null}
    </p>
  );
}
