"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { DeliveryGuideTab } from "./DeliveryGuideTab";
import { MismatchTab } from "./MismatchTab";
import { NoticeStatusTab } from "./NoticeStatusTab";
import { PreviewTab } from "./PreviewTab";
import { SiteSettingsTab } from "./SiteSettingsTab";
import { DEFAULT_INTERNAL_TAB, INTERNAL_TAB_IDS, INTERNAL_TAB_LABELS, type InternalTabId } from "./tabs";
import { HELP_CLASS } from "./ui";

const DESK_TITLE = "배송·통관 CS 데스크";
const DESK_INTRO = "번호를 한꺼번에 조회해 고객 답변을 만들고, 통관부호 불일치 안내와 공지를 관리합니다. 조회 결과와 복사 이력은 저장하지 않습니다.";
const TABLIST_LABEL = "CS 데스크 메뉴";
const TAB_CLASS =
  "tt-focus min-h-[44px] border-0 border-b-4 border-solid border-transparent bg-transparent px-4 text-tt-md font-bold text-tt-muted aria-selected:border-tt-ink aria-selected:text-tt-ink";

const tabElementId = (id: InternalTabId): string => `cs-tab-${id}`;
const panelElementId = (id: InternalTabId): string => `cs-panel-${id}`;

/** The desk's reference time: read once, on the client, the first time a snapshot is taken (never during server render). */
let deskNow: Date | null = null;
const subscribeNever = (): (() => void) => () => undefined;
function readDeskNow(): Date {
  if (deskNow === null) deskNow = new Date();
  return deskNow;
}
const readServerNow = (): null => null;

/** Where a key moves the selection (automatic activation; the arrows wrap). */
function targetIndex(key: string, index: number, last: number): number | null {
  switch (key) {
    case "ArrowRight":
      return index === last ? 0 : index + 1;
    case "ArrowLeft":
      return index === 0 ? last : index - 1;
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}

function TabContent({ id, now }: { readonly id: InternalTabId; readonly now: Date | null }): React.JSX.Element {
  switch (id) {
    case "delivery":
      return <DeliveryGuideTab />;
    case "mismatch":
      return <MismatchTab />;
    case "preview":
      return <PreviewTab now={now} />;
    case "notices":
      return <NoticeStatusTab now={now} />;
    case "site":
      return <SiteSettingsTab />;
  }
}

/**
 * The internal CS desk (spec §10): one tablist, one panel per tab. A panel mounts the first time its tab is chosen and
 * then stays mounted (hidden), so a running bulk lookup or a half-written draft survives a tab switch.
 */
export function InternalCsDesk({ initialTab = DEFAULT_INTERNAL_TAB }: { readonly initialTab?: InternalTabId }): React.JSX.Element {
  const now = useSyncExternalStore(subscribeNever, readDeskNow, readServerNow);
  const [active, setActive] = useState<InternalTabId>(initialTab);
  const [opened, setOpened] = useState<ReadonlySet<InternalTabId>>(() => new Set([initialTab]));
  const tabRefs = useRef<Partial<Record<InternalTabId, HTMLButtonElement | null>>>({});

  const select = (id: InternalTabId, moveFocus: boolean): void => {
    setActive(id);
    setOpened((previous) => (previous.has(id) ? previous : new Set([...previous, id])));
    if (moveFocus) tabRefs.current[id]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    const target = targetIndex(event.key, INTERNAL_TAB_IDS.indexOf(active), INTERNAL_TAB_IDS.length - 1);
    if (target === null) return;
    event.preventDefault();
    select(INTERNAL_TAB_IDS[target], true);
  };

  return (
    <main
      // Present once the desk has hydrated (the reference time is read on the client only); tests wait for it.
      data-desk-ready={now === null ? undefined : "true"}
      className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 pb-16 pt-6 text-tt-ink"
    >
      <header className="flex flex-col gap-2">
        <h1 className="m-0 font-tt-display text-tt-xl [font-weight:var(--tt-weight-display)]">{DESK_TITLE}</h1>
        <p className={HELP_CLASS}>{DESK_INTRO}</p>
      </header>
      <div role="tablist" aria-label={TABLIST_LABEL} className="flex flex-wrap gap-1 border-0 border-b-2 border-solid border-tt-rule">
        {INTERNAL_TAB_IDS.map((id) => (
          <button
            key={id}
            ref={(node) => {
              tabRefs.current[id] = node;
            }}
            type="button"
            role="tab"
            id={tabElementId(id)}
            aria-selected={id === active}
            aria-controls={panelElementId(id)}
            tabIndex={id === active ? 0 : -1}
            data-internal-tab-button={id}
            onClick={() => select(id, false)}
            onKeyDown={onKeyDown}
            className={TAB_CLASS}
          >
            {INTERNAL_TAB_LABELS[id]}
          </button>
        ))}
      </div>
      {INTERNAL_TAB_IDS.map((id) => (
        <section
          key={id}
          role="tabpanel"
          id={panelElementId(id)}
          aria-labelledby={tabElementId(id)}
          data-internal-tab={id}
          hidden={id !== active}
          tabIndex={0}
          className="tt-focus"
        >
          {opened.has(id) ? <TabContent id={id} now={now} /> : null}
        </section>
      ))}
    </main>
  );
}
