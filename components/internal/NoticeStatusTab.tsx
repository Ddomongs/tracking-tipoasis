"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/primitives/Button";
import { deriveResultView } from "@/components/result/approvals";
import { siteConfig } from "@/config/site.config";
import type { HolidayPeriod, Notice } from "@/lib/config/types";
import { buildCsReply, type CsReply } from "@/lib/cs/cs-reply";
import { groupNoticesAt, holidayAt, noticePlacementAt, type NoticeGroups, type NoticePlacement, type NoticeWindow } from "@/lib/cs/notice-status";
import { buildPreviewScenario, type PreviewScenarioId } from "@/lib/cs/preview-outcomes";
import { formatKstDateTime, formatKstTime, kstDateKey, parseInstant } from "@/lib/tracking/time";
import type { NoticeKind, TrackingViewModel } from "@/lib/tracking/types";
import { ScreenAndReply } from "./ScreenAndReply";
import { ERROR_CLASS, FIELD_CLASS, HELP_CLASS, LABEL_CLASS, PANEL_CLASS, SECTION_TITLE_CLASS } from "./ui";

const KIND_LABELS: Readonly<Record<NoticeKind, string>> = { outage: "장애", delay: "지연", holiday: "연휴", info: "안내" };
const GROUP_TITLES: Readonly<Record<NoticeWindow, string>> = { active: "진행 중", scheduled: "예정", expired: "종료" };
const GROUP_ORDER: readonly NoticeWindow[] = ["active", "scheduled", "expired"];
const SIMULATED: readonly { readonly id: PreviewScenarioId; readonly title: string }[] = [
  { id: "customsWaiting", title: "통관 대기 화면 (안내 한 줄·연휴 배지)" },
  { id: "customsWaitingOverdue", title: "걱정 기준일이 지난 화면" }
];
const INPUT_VALUE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const NONE = "없음";
const PREPARING = "공지 현황을 준비하고 있어요.";
const INCOMPLETE_MESSAGE = "날짜와 시각을 모두 골라 주세요.";
const INTRO = "날짜와 시각을 고르면 그때 보이는 공지, 연휴 배지와 걱정 기준일이 지난 화면을 보여 줍니다. 시각은 한국 시간으로 읽습니다.";

interface SimulatedScreen {
  readonly id: PreviewScenarioId;
  readonly title: string;
  readonly view: TrackingViewModel;
  readonly reply: CsReply;
}

interface Simulation {
  readonly at: Date;
  readonly groups: NoticeGroups;
  readonly placement: NoticePlacement;
  readonly holiday: HolidayPeriod | null;
  readonly screens: readonly SimulatedScreen[];
}

/** 'YYYY-MM-DDTHH:mm' in Korean time, for a datetime-local input. */
function toKstInputValue(instant: Date): string {
  return `${kstDateKey(instant)}T${formatKstTime(instant)}`;
}

/** The instant a datetime-local value names when read as Korean time; null while incomplete. */
function fromKstInputValue(value: string): Date | null {
  return INPUT_VALUE.test(value) ? parseInstant(`${value}:00+09:00`) : null;
}

function simulate(at: Date): Simulation {
  return {
    at,
    groups: groupNoticesAt(siteConfig.notices, at),
    placement: noticePlacementAt(siteConfig.notices, at),
    holiday: holidayAt(at, siteConfig.calendar),
    screens: SIMULATED.map(({ id, title }) => {
      const view = deriveResultView(buildPreviewScenario(id, at).outcome, at);
      return { id, title, view, reply: buildCsReply(view, { now: at, notices: siteConfig.notices }) };
    })
  };
}

function noticePlaces(notice: Notice): string {
  const places = [
    notice.home ? "홈" : null,
    notice.guideKeys.length > 0 ? `결과 화면 ${notice.guideKeys.length}곳` : null,
    notice.cs ? "CS 답변" : null
  ].filter((place): place is string => place !== null);
  return places.length === 0 ? "보이는 곳 없음" : places.join(" · ");
}

function NoticeItem({ notice }: { readonly notice: Notice }): React.JSX.Element {
  const starts = parseInstant(notice.startsAt);
  const ends = parseInstant(notice.endsAt);
  const period = starts === null || ends === null ? "" : `${formatKstDateTime(starts)} ~ ${formatKstDateTime(ends)}`;
  return (
    <li data-notice-id={notice.id} className="flex flex-col gap-1 border-0 border-b border-solid border-tt-rule py-2">
      <p className="m-0 text-tt-md font-bold [word-break:keep-all]">{`[${KIND_LABELS[notice.kind]}] ${notice.title}`}</p>
      <p className="m-0 text-tt-sm [word-break:keep-all]">{notice.body}</p>
      <p className={HELP_CLASS}>{`${period} · ${noticePlaces(notice)}`}</p>
    </li>
  );
}

function SimulationView({ simulation }: { readonly simulation: Simulation }): React.JSX.Element {
  const baseId = useId();
  const { at, groups, placement, holiday, screens } = simulation;
  const results = placement.results.map(({ guideKey, notice }) => `${siteConfig.stateGuide[guideKey].docTitle}: ${notice.title}`);
  return (
    <>
      <section data-notice-simulation={at.toISOString()} aria-labelledby={`${baseId}-places`} className={PANEL_CLASS}>
        <h2 id={`${baseId}-places`} className={SECTION_TITLE_CLASS}>
          {`${formatKstDateTime(at)}에 보이는 곳`}
        </h2>
        <dl data-notice-places="true" className="m-0 grid gap-x-4 gap-y-2 text-tt-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
          <dt className="font-bold">홈 공지</dt>
          <dd data-place="home" className="m-0">
            {placement.home?.title ?? NONE}
          </dd>
          <dt className="font-bold">CS 답변 끝</dt>
          <dd data-place="cs" className="m-0">
            {placement.cs.length === 0 ? NONE : placement.cs.map((notice) => notice.title).join(" · ")}
          </dd>
          <dt className="font-bold">결과 화면 안내</dt>
          <dd data-place="results" className="m-0 [word-break:keep-all]">
            {results.length === 0 ? NONE : results.join(" / ")}
          </dd>
          <dt className="font-bold">연휴</dt>
          <dd data-notice-holiday={holiday?.id ?? "none"} className="m-0">
            {holiday === null ? "공휴일 아님" : `${holiday.name} · ${holiday.badge}`}
          </dd>
        </dl>
      </section>
      <section aria-labelledby={`${baseId}-lists`} className={PANEL_CLASS}>
        <h2 id={`${baseId}-lists`} className={SECTION_TITLE_CLASS}>
          공지 목록
        </h2>
        {GROUP_ORDER.map((group) => (
          <div key={group} className="flex flex-col gap-1">
            <h3 className="m-0 text-tt-md font-bold">{`${GROUP_TITLES[group]} ${groups[group].length}건`}</h3>
            {groups[group].length === 0 ? (
              <p className={HELP_CLASS}>{NONE}</p>
            ) : (
              <ul data-notice-group={group} className="m-0 list-none p-0">
                {groups[group].map((notice) => (
                  <NoticeItem key={notice.id} notice={notice} />
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>
      <section aria-labelledby={`${baseId}-screens`} className={PANEL_CLASS}>
        <h2 id={`${baseId}-screens`} className={SECTION_TITLE_CLASS}>
          화면 시뮬레이션
        </h2>
        {screens.map((screen) => (
          <div key={screen.id} data-simulated-screen={screen.id} className="flex flex-col gap-2">
            <h3 className="m-0 text-tt-md font-bold">{screen.title}</h3>
            <ScreenAndReply view={screen.view} reply={screen.reply} />
          </div>
        ))}
      </section>
    </>
  );
}

/** 공지 현황 (spec §10 ④): active, scheduled and expired notices, and a KST time simulator for notices, holidays and overdue. */
export function NoticeStatusTab({ now }: { readonly now: Date | null }): React.JSX.Element {
  const baseId = useId();
  const [input, setInput] = useState<string | null>(null);
  const value = input ?? (now === null ? "" : toKstInputValue(now));
  const simulation = useMemo(() => {
    const at = fromKstInputValue(value);
    return at === null ? null : simulate(at);
  }, [value]);
  if (input === null && now === null) return <p className={HELP_CLASS}>{PREPARING}</p>;
  return (
    <div className="flex flex-col gap-4">
      <div className={PANEL_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>공지 현황</h2>
        <p className={HELP_CLASS}>{INTRO}</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${baseId}-at`} className={LABEL_CLASS}>
              기준 시각 (한국 시간)
            </label>
            <input
              id={`${baseId}-at`}
              type="datetime-local"
              value={value}
              onChange={(event) => setInput(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>
          <Button variant="secondary" onClick={() => setInput(toKstInputValue(new Date()))}>
            지금으로
          </Button>
        </div>
        {simulation === null ? (
          <p role="alert" className={ERROR_CLASS}>
            {INCOMPLETE_MESSAGE}
          </p>
        ) : null}
      </div>
      {simulation === null ? null : <SimulationView simulation={simulation} />}
    </div>
  );
}
