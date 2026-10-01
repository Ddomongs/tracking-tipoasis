"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/primitives/Button";
import { deriveResultView } from "@/components/result/approvals";
import { siteConfig } from "@/config/site.config";
import { BULK_MAX, initialBulkRows, parseBulkInput, runBulkLookup, sortBulkRows, type BulkRow } from "@/lib/cs/bulk-lookup";
import { buildCsReply, type CsReply } from "@/lib/cs/cs-reply";
import { CARRIER_NAMES, CONCRETE_CARRIER_CODES } from "@/lib/tracking/carriers";
import type { DeliveryCarrierCode } from "@/lib/types";
import { BulkResultTable } from "./BulkResultTable";
import { ERROR_CLASS, FIELD_CLASS, HELP_CLASS, LABEL_CLASS, PANEL_CLASS, SECTION_TITLE_CLASS } from "./ui";

const INPUT_LABEL = `조회번호 (한 줄에 하나, 최대 ${BULK_MAX}건)`;
const INPUT_HELP =
  "고객이 보낸 '[배송 문의] …' 복사 내용을 그대로 붙여 넣어도 번호를 읽어요. 숫자가 없는 줄은 건너뛰고, 휴대폰 번호는 조회하지 않아요.";
const NO_NUMBERS_MESSAGE = "조회할 번호가 없어요. 숫자 10~14자리 또는 영문 3~4자로 시작하는 번호를 한 줄에 하나씩 넣어 주세요.";
const TRUNCATED_MESSAGE = `최대 ${BULK_MAX}건까지만 조회해요. 나머지 번호는 빠졌어요.`;
const NOT_STORED_NOTE = "조회 결과와 복사 이력은 저장하지 않습니다.";
const CARRIER_OPTIONS: readonly { readonly code: DeliveryCarrierCode; readonly label: string }[] = [
  { code: "AUTO", label: "자동으로 찾기" },
  ...CONCRETE_CARRIER_CODES.map((code) => ({ code, label: CARRIER_NAMES[code] }))
];

interface ParseNote {
  readonly rejected: readonly string[];
  readonly truncated: boolean;
}

/**
 * 배송 안내 (spec §10 ①): paste up to 20 numbers, look them up one per second through fetchTrack, derive the customer
 * page's own view for each, and show 문제/확인 필요 first. Nothing is stored; a new run or [멈추기] ends the previous run.
 */
export function DeliveryGuideTab(): React.JSX.Element {
  const baseId = useId();
  const [text, setText] = useState("");
  const [carrier, setCarrier] = useState<DeliveryCarrierCode>("AUTO");
  const [rows, setRows] = useState<readonly BulkRow[]>([]);
  const [replies, setReplies] = useState<Readonly<Record<string, CsReply>>>({});
  const [note, setNote] = useState<ParseNote | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  /** The last request start of any run: a restarted run still waits BULK_MIN_INTERVAL_MS after it. */
  const lastStartRef = useRef<number | null>(null);
  const displayRows = useMemo(() => sortBulkRows(rows), [rows]);
  const doneCount = rows.filter((row) => row.status === "done").length;

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    controllerRef.current?.abort();
    runIdRef.current += 1;
    const runId = runIdRef.current;
    const isCurrent = (): boolean => runIdRef.current === runId;
    const parsed = parseBulkInput(text);
    setNote({ rejected: parsed.rejected, truncated: parsed.truncated });
    setExpanded(null);
    if (parsed.numbers.length === 0) {
      setError(NO_NUMBERS_MESSAGE);
      setRows([]);
      setRunning(false);
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setError("");
    setRows(initialBulkRows(parsed.numbers));
    setReplies({});
    setRunning(true);
    void runBulkLookup(parsed.numbers, carrier, {
      signal: controller.signal,
      now: () => new Date(),
      derive: deriveResultView,
      lastStart: lastStartRef.current,
      onStart: (at) => {
        lastStartRef.current = at;
      },
      onRow: (index, row) => {
        if (!isCurrent()) return;
        setRows((previous) => previous.map((item, position) => (position === index ? row : item)));
        if (row.view === null) return;
        const reply = buildCsReply(row.view, { now: new Date(), notices: siteConfig.notices });
        setReplies((previous) => ({ ...previous, [row.number]: reply }));
      }
    }).finally(() => {
      if (isCurrent()) setRunning(false);
    });
  };

  const onStop = (): void => {
    controllerRef.current?.abort();
  };

  const onToggle = (number: string): void => {
    setExpanded((current) => (current === number ? null : number));
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} noValidate aria-labelledby={`${baseId}-title`} className={PANEL_CLASS}>
        <h2 id={`${baseId}-title`} className={SECTION_TITLE_CLASS}>
          배송 안내 일괄 조회
        </h2>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${baseId}-numbers`} className={LABEL_CLASS}>
            {INPUT_LABEL}
          </label>
          <p id={`${baseId}-help`} className={HELP_CLASS}>
            {INPUT_HELP}
          </p>
          <textarea
            id={`${baseId}-numbers`}
            aria-describedby={`${baseId}-help`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={6}
            spellCheck={false}
            autoComplete="off"
            className={`${FIELD_CLASS} font-tt-mono`}
          />
        </div>
        <fieldset className="m-0 flex flex-wrap gap-x-4 gap-y-1 border-0 p-0">
          <legend className={`${LABEL_CLASS} mb-1`}>택배사</legend>
          {CARRIER_OPTIONS.map((option) => (
            <label key={option.code} className="flex min-h-[44px] items-center gap-2 text-tt-md">
              <input
                type="radio"
                name={`${baseId}-carrier`}
                value={option.code}
                checked={carrier === option.code}
                onChange={() => setCarrier(option.code)}
                className="tt-focus h-6 w-6"
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        {error === "" ? null : (
          <p role="alert" className={ERROR_CLASS}>
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" busy={running}>
            조회 시작
          </Button>
          {running ? (
            <Button variant="secondary" onClick={onStop}>
              멈추기
            </Button>
          ) : null}
          <p className={HELP_CLASS}>{NOT_STORED_NOTE}</p>
        </div>
      </form>
      {note !== null && note.truncated ? <p className={ERROR_CLASS}>{TRUNCATED_MESSAGE}</p> : null}
      {note !== null && note.rejected.length > 0 ? (
        <p data-bulk-rejected="true" className={HELP_CLASS}>
          {`번호로 읽지 못한 줄 ${note.rejected.length}개: ${note.rejected.join(" · ")}`}
        </p>
      ) : null}
      {rows.length === 0 ? null : (
        <p role="status" data-bulk-progress="true" className={HELP_CLASS}>
          {`${rows.length}건 중 ${doneCount}건 조회함${running ? " · 1초에 1건씩 조회해요" : ""}`}
        </p>
      )}
      <BulkResultTable rows={displayRows} replies={replies} expanded={expanded} onToggle={onToggle} />
    </div>
  );
}
