import type { SpineIssue, Tone } from "@/lib/tracking/types";

const TONE_PATHS: Readonly<Record<Tone, readonly string[]>> = {
  neutral: ["M5 12h14"],
  progress: ["M4 12h14", "M13 6l6 6-6 6"],
  waiting: ["M12 7v5l3 2"],
  attention: ["M12 7v6", "M12 16v1"],
  problem: ["M12 3L2 21h20z", "M12 10v5", "M12 18v1"],
  done: ["M4 12.5l5 5L20 6.5"]
};

const ISSUE_PATHS: Readonly<Record<SpineIssue, readonly string[]>> = {
  stopped: ["M9 5v14", "M15 5v14"],
  cut: ["M10 7H7a5 5 0 0 0 0 10h3", "M14 7h3a5 5 0 0 1 0 10h-3"],
  branch: ["M12 21v-8", "M12 13L5 4", "M12 13l7-9"]
};

const CIRCLED_TONES: ReadonlySet<Tone> = new Set<Tone>(["waiting", "attention"]);

/**
 * Decorative status icon (always aria-hidden; the status is always also written as text, WCAG 1.4.1).
 * Sized 1em so it follows the text next to it; drawn with currentColor.
 */
export function ToneIcon({ tone, issue = null }: { readonly tone: Tone; readonly issue?: SpineIssue | null }): React.JSX.Element {
  const paths = issue ? ISSUE_PATHS[issue] : TONE_PATHS[tone];
  const circled = !issue && CIRCLED_TONES.has(tone);
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-tone-icon={issue ?? tone}
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className="shrink-0"
    >
      {circled ? <circle cx="12" cy="12" r="9" /> : null}
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
