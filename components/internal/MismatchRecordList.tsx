"use client";

import { useId } from "react";
import { Button } from "@/components/primitives/Button";
import { CopyButton } from "@/components/primitives/CopyButton";
import {
  MISMATCH_STATUSES,
  MISMATCH_STATUS_LABELS,
  isMismatchStatus,
  type MismatchRecord,
  type MismatchStatus
} from "@/lib/cs/mismatch-storage";
import { maskPhone } from "@/lib/cs/phone-mask";
import { formatKstDateTime, parseInstant } from "@/lib/tracking/time";
import { FIELD_CLASS, HELP_CLASS, LABEL_CLASS, PANEL_CLASS, SECTION_TITLE_CLASS } from "./ui";

const COPIED_LABEL = "복사했어요";
const EMPTY_MESSAGE = "저장된 통관부호 불일치 안내가 없습니다.";
const NO_MEMO = "메모 없음";

export interface MismatchRecordListProps {
  readonly records: readonly MismatchRecord[];
  /** The retention line (and, with approval 14, the 7-day keep control) under the count. */
  readonly retention: React.ReactNode;
  readonly onStatus: (id: string, status: MismatchStatus) => void;
  readonly onDelete: (id: string) => void;
  readonly onClearAll: () => void;
}

function savedAt(record: MismatchRecord): string {
  const instant = parseInstant(record.createdAt);
  return instant === null ? "" : formatKstDateTime(instant);
}

interface MismatchRecordItemProps {
  readonly record: MismatchRecord;
  readonly onStatus: (id: string, status: MismatchStatus) => void;
  readonly onDelete: (id: string) => void;
}

/** One draft: the phone only masked (spec §10), memo and time, status, and copy/delete. The tool never sends anything. */
function MismatchRecordItem({ record, onStatus, onDelete }: MismatchRecordItemProps): React.JSX.Element {
  const id = useId();
  return (
    <article
      aria-labelledby={`${id}-phone`}
      data-mismatch-record={record.id}
      data-mismatch-status={record.status}
      className="flex flex-col gap-3 border-2 border-solid border-tt-rule bg-tt-surface p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p id={`${id}-phone`} className="m-0 font-tt-mono text-tt-md font-bold">
            {maskPhone(record.phone)}
          </p>
          <p className={HELP_CLASS}>{`${record.trackingMemo || NO_MEMO} · ${savedAt(record)}`}</p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-status`} className={LABEL_CLASS}>
            진행 상태
          </label>
          <select
            id={`${id}-status`}
            value={record.status}
            onChange={(event) => {
              const next = event.target.value;
              if (isMismatchStatus(next)) onStatus(record.id, next);
            }}
            className={FIELD_CLASS}
          >
            {MISMATCH_STATUSES.map((status) => (
              <option key={status} value={status}>
                {MISMATCH_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="m-0 whitespace-pre-wrap bg-tt-ground p-3 text-tt-sm [overflow-wrap:anywhere]">{record.content}</p>
      <div className="flex flex-wrap items-start gap-2">
        <CopyButton mode="copy" text={record.phone} label="휴대폰 번호 복사" copiedLabel={COPIED_LABEL} variant="secondary" />
        <CopyButton mode="copy" text={record.content} label="안내 내용 복사" copiedLabel={COPIED_LABEL} variant="secondary" />
        <Button variant="text" onClick={() => onDelete(record.id)}>
          삭제
        </Button>
      </div>
    </article>
  );
}

export function MismatchRecordList({ records, retention, onStatus, onDelete, onClearAll }: MismatchRecordListProps): React.JSX.Element {
  const titleId = useId();
  const sorted = [...records].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return (
    <section aria-labelledby={titleId} className={PANEL_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={titleId} className={SECTION_TITLE_CLASS}>
            불일치 안내 목록
          </h2>
          <p className={HELP_CLASS}>{`${sorted.length}건 저장됨`}</p>
          {retention}
        </div>
        {sorted.length === 0 ? null : (
          <Button variant="secondary" onClick={onClearAll}>
            전체 삭제
          </Button>
        )}
      </div>
      {sorted.length === 0 ? (
        <p data-mismatch-empty="true" className={HELP_CLASS}>
          {EMPTY_MESSAGE}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {sorted.map((record) => (
            <li key={record.id}>
              <MismatchRecordItem record={record} onStatus={onStatus} onDelete={onDelete} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
