import type { EtaDate, EtaView } from "@/lib/tracking/types";

const DDAY_PREFIX = "D-";

type ShownEta = Exclude<EtaView, { readonly kind: "none" }>;

function Digits({ value }: { readonly value: number }): React.JSX.Element {
  return (
    <>
      {String(value)
        .split("")
        .map((digit, index) => (
          <span key={`${index}-${digit}`} data-eta-digit={digit}>
            {digit}
          </span>
        ))}
    </>
  );
}

/**
 * Screen readers get one sentence (`date.label`, e.g. '9월 30일 (수)'); the visual is aria-hidden and split
 * into month/day/weekday parts and single digits so each style can draw it its own way (signal: big numerals,
 * night: digit tiles). The visual text equals the label because S03 formats the label as `${month}월 ${day}일 (${weekday})`.
 */
function DateValue({ date, dday }: { readonly date: EtaDate; readonly dday: number | null }): React.JSX.Element {
  return (
    <p data-eta-value="true">
      <span className="sr-only">{date.label}</span>
      <span aria-hidden="true" data-eta-visual="true">
        <span data-eta-part="month">
          <Digits value={date.month} />월
        </span>{" "}
        <span data-eta-part="day">
          <Digits value={date.day} />일
        </span>{" "}
        <span data-eta-part="weekday">({date.weekday})</span>
      </span>
      {dday === null ? null : <span data-eta-dday={String(dday)}>{`${DDAY_PREFIX}${dday}`}</span>}
    </p>
  );
}

function CalendarIcon(): React.JSX.Element {
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
      className="shrink-0"
    >
      <path d="M3 5h18v16H3z" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

function Caption({ text }: { readonly text: string | null }): React.JSX.Element | null {
  return text === null ? null : <p data-eta-caption="true">{text}</p>;
}

function EtaBody({ eta }: { readonly eta: ShownEta }): React.JSX.Element {
  switch (eta.kind) {
    case "date":
      return (
        <>
          <DateValue date={eta.date} dday={eta.dday} />
          <Caption text={eta.caption} />
        </>
      );
    case "today":
      return (
        <>
          <DateValue date={eta.date} dday={null} />
          <Caption text={eta.caption} />
        </>
      );
    case "holidayAffected":
      // Holiday overlap hides D-n and '오늘 예상' (spec §6); the badge says why.
      return (
        <>
          <DateValue date={eta.date} dday={null} />
          <span data-eta-badge="true">
            <CalendarIcon />
            {eta.badge}
          </span>
          <Caption text={eta.caption} />
        </>
      );
    case "overdue":
    case "deliveredOn":
      return <DateValue date={eta.date} dday={null} />;
    case "pendingInfo":
    case "withheld":
    case "unknown":
      return <p data-eta-text="true">{eta.text}</p>;
  }
}

/** The `eta` variant slot (spec §6 도착 예상). Renders only view-model strings plus the prefix 'D-'. */
export function EtaDisplay({ eta }: { readonly eta: EtaView }): React.JSX.Element | null {
  if (eta.kind === "none") return null;
  return (
    <div data-slot="eta" data-eta-kind={eta.kind}>
      <p data-eta-label="true">{eta.label}</p>
      <EtaBody eta={eta} />
    </div>
  );
}
