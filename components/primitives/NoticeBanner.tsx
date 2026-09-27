import type { NoticeView } from "@/lib/tracking/types";

const NOTICE_LEAD = "안내";

function NoticeIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className="mt-0.5 shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <path d="M12 7v1" />
    </svg>
  );
}

/**
 * Notice line. "banner": the home strip under the header (ground, 12px, about two lines).
 * "inline": the '안내' line inside the status card; it inherits the field's text color.
 * Never a live region — notices are not announced on page load. Shows '안내' + body; `title` is for CS replies
 * and the internal notices tab.
 */
export function NoticeBanner({ notice, variant }: { readonly notice: NoticeView; readonly variant: "banner" | "inline" }): React.JSX.Element {
  if (variant === "banner") {
    return (
      <aside
        aria-label={NOTICE_LEAD}
        data-notice-kind={notice.kind}
        data-notice-variant="banner"
        className="bg-tt-ground px-[var(--tt-gutter)] py-2.5 text-tt-ink"
      >
        <p className="m-0 mx-auto max-w-[var(--tt-column)] text-tt-xs font-medium [word-break:keep-all]">
          <strong className="font-black">{NOTICE_LEAD}</strong> {notice.body}
        </p>
      </aside>
    );
  }
  return (
    <p
      data-notice-kind={notice.kind}
      data-notice-variant="inline"
      className="m-0 flex items-start gap-1.5 text-tt-sm font-medium [word-break:keep-all]"
    >
      <NoticeIcon />
      <span>
        <strong className="font-black">{NOTICE_LEAD}</strong> {notice.body}
      </span>
    </p>
  );
}
