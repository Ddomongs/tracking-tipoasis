"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { useAnnounce } from "@/components/primitives/LiveAnnouncer";

const SHARE_LABEL = "공유하기";
const TITLE = "이 페이지 공유하기";
const NATIVE_LABEL = "카카오톡·메시지로 보내기";
const COPY_LABEL = "링크 복사";
const COPIED = "링크를 복사했어요. 원하는 곳에 붙여 넣어 주세요.";
const COPY_FAILED = "복사하지 못했어요. 위 링크를 길게 눌러 복사해 주세요.";
const WITH_NUMBER_LABEL = "조회번호도 함께 보내기";
const WITH_NUMBER_HINT = "받는 사람이 링크를 열면 바로 같은 배송 현황을 봐요. 번호는 체크했을 때만 링크에 들어가요.";
const CLOSE_LABEL = "닫기";
const SHARE_TITLE = "통관·배송 조회";
const SHARE_TEXT_SITE = "HBL·운송장 번호 하나로 해외 직구 통관과 택배 배송을 확인하세요.";
const SHARE_TEXT_RESULT = "해외 배송 현황을 확인해 보세요.";
// The same round button as the day/night switch next to it.
const BUTTON_CLASS =
  "tt-focus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-tt-control bg-tt-surface text-tt-ink";
const ACTION_CLASS =
  "tt-focus inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-tt-button border-2 px-4 text-tt-md font-bold";

/** The page as it is now, without query or fragment. A result page reads '/' (lib/privacy/url-scrub keeps numbers out of the address). */
function pageUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/** The number on the result's number bar, if a result is on screen. */
function shownNumber(): string | null {
  if (document.querySelector("[data-result-view]") === null) return null;
  const value = document.querySelector("[data-number-bar-value]")?.textContent?.trim() ?? "";
  return value === "" ? null : value;
}

function linkFor(number: string | null): string {
  return number === null ? pageUrl() : `${window.location.origin}/${encodeURIComponent(number)}`;
}

function ShareIcon(): React.JSX.Element {
  return (
    <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="M8.2,10.8L15.8,6.2M8.2,13.2L15.8,17.8" />
    </svg>
  );
}

/**
 * Share (10월 4일 요청): a round header button opening a small menu. Phones get the system share sheet (카카오톡,
 * 문자 and every other app the phone offers, no Kakao SDK or key); every browser gets 링크 복사 with the link shown
 * for long-press copying. The link is the page without the number; on a result the customer may tick '조회번호도 함께
 * 보내기' to share '/{번호}' instead (off each time the menu opens). Nothing is sent to us.
 * The menu is portalled to <body> so the header's white-on-blue styles do not reach it.
 */
export function ShareMenu(): React.JSX.Element {
  const menuId = useId();
  const titleId = `${menuId}-title`;
  const announce = useAnnounce();
  const [status, setStatus] = useState<string | null>(null);
  const [number, setNumber] = useState<string | null>(null);
  const [withNumber, setWithNumber] = useState(false);
  const link = typeof window === "undefined" ? "" : linkFor(withNumber ? number : null);
  const canShareNatively = typeof navigator.share === "function";

  const refresh = (event: React.ToggleEvent<HTMLDivElement>): void => {
    if (event.newState !== "open") return;
    setNumber(shownNumber());
    setWithNumber(false);
    setStatus(null);
  };

  const shareNatively = (): void => {
    const shared = { title: SHARE_TITLE, text: withNumber ? SHARE_TEXT_RESULT : SHARE_TEXT_SITE, url: link };
    // A cancelled share sheet rejects with AbortError: nothing to say.
    navigator.share(shared).catch(() => undefined);
  };

  const copy = (): void => {
    const done = (message: string): void => {
      setStatus(message);
      announce(message);
    };
    if (navigator.clipboard === undefined) {
      done(COPY_FAILED);
      return;
    }
    navigator.clipboard.writeText(link).then(
      () => done(COPIED),
      () => done(COPY_FAILED)
    );
  };

  return (
    <>
      <button type="button" aria-label={SHARE_LABEL} popoverTarget={menuId} data-share-toggle="true" className={BUTTON_CLASS}>
        <ShareIcon />
      </button>
      {createPortal(
        <div
          id={menuId}
          popover="auto"
          role="dialog"
          aria-labelledby={titleId}
          data-share-menu="true"
          onToggle={refresh}
          className="flex-col gap-3 bg-tt-surface p-4 text-tt-ink"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id={titleId} className="m-0 text-tt-lg font-bold [word-break:keep-all]">
              {TITLE}
            </h2>
            <button
              type="button"
              popoverTarget={menuId}
              popoverTargetAction="hide"
              className="tt-focus inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-tt-sm font-bold underline underline-offset-[4px]"
            >
              {CLOSE_LABEL}
            </button>
          </div>
          <input
            type="text"
            readOnly
            value={link}
            aria-label="공유할 링크"
            data-share-link="true"
            onFocus={(event) => event.currentTarget.select()}
            className="tt-focus min-h-[44px] w-full rounded-tt-button border border-tt-control bg-tt-surface px-3 font-tt-mono text-tt-sm"
          />
          {canShareNatively ? (
            <button type="button" onClick={shareNatively} data-share-native="true" className={`${ACTION_CLASS} border-tt-primary bg-tt-primary text-tt-on-primary`}>
              {NATIVE_LABEL}
            </button>
          ) : null}
          <button type="button" onClick={copy} data-share-copy="true" className={`${ACTION_CLASS} border-tt-ink bg-tt-surface text-tt-ink`}>
            {COPY_LABEL}
          </button>
          {number === null ? null : (
            <label className="flex min-h-[44px] items-start gap-2 text-tt-sm [word-break:keep-all]">
              <input
                type="checkbox"
                checked={withNumber}
                onChange={(event) => {
                  setWithNumber(event.currentTarget.checked);
                  setStatus(null);
                }}
                data-share-with-number="true"
                className="tt-focus mt-0.5 h-5 w-5 shrink-0"
              />
              <span>
                <span className="block font-bold">{WITH_NUMBER_LABEL}</span>
                <span className="block text-tt-muted">{WITH_NUMBER_HINT}</span>
              </span>
            </label>
          )}
          <p role="status" data-share-status="true" className="m-0 min-h-[20px] text-tt-sm font-bold [word-break:keep-all]">
            {status ?? ""}
          </p>
        </div>,
        document.body
      )}
    </>
  );
}
