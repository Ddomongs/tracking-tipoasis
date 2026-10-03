import { FailureFallback } from "@/components/lookup/FailureFallback";
import { buttonClassName } from "@/components/primitives/Button";
import { STORE_SHEET_ID } from "@/components/supplementary/store-sheet";

export const SHORTCUT_REGION_LABEL = "상담·스토어 바로가기";
const OPEN_CLASS = buttonClassName("secondary", "md", "w-full");

function StoreIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M4,8H20L19,20H5Z M8.5,8V6.5A3.5,3.5,0,0,1,15.5,6.5V8" />
    </svg>
  );
}

/**
 * Region '상담·스토어 바로가기' right under [조회하기] (spec §4, approval 1 — 10월 2일 요청으로 간소화): one secondary
 * button that opens the store sheet (a native popover, no script: components/supplementary/StoreShowcase.tsx) with the
 * definitive disclosure before the store links. 톡톡 stays in the header and the footer. On wide screens the sheet is a
 * fixed panel beside the column, so the button hides (app/globals.css). While the number is invalid only 톡톡 stays — as
 * the error CTA block, so the screen keeps one 톡톡 place besides the header and the footer (spec §8 "화면당 최대 3곳").
 */
export function ShortcutRow({ mode, openLabel }: { readonly mode: "full" | "talkOnly"; readonly openLabel: string }): React.JSX.Element {
  if (mode === "talkOnly") {
    return (
      <section aria-label={SHORTCUT_REGION_LABEL} data-shortcut-row="talkOnly">
        <FailureFallback guideKey="invalidNumber" />
      </section>
    );
  }
  return (
    <section aria-label={SHORTCUT_REGION_LABEL} data-shortcut-row="full" className="px-[var(--tt-gutter)]">
      <button
        type="button"
        popoverTarget={STORE_SHEET_ID}
        data-store-sheet-open="true"
        data-emphasis="true"
        data-slot="button"
        data-variant="secondary"
        data-size="md"
        className={OPEN_CLASS}
      >
        <StoreIcon />
        {openLabel}
      </button>
    </section>
  );
}
