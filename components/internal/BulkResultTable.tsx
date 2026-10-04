"use client";

import { Fragment, useId } from "react";
import { Button } from "@/components/primitives/Button";
import { CopyButton } from "@/components/primitives/CopyButton";
import { StatusChip } from "@/components/primitives/StatusChip";
import { summarizeBulkView, type BulkRow } from "@/lib/cs/bulk-lookup";
import type { CsReply } from "@/lib/cs/cs-reply";
import { compactTrackingNumber } from "@/lib/tracking/number-format";
import type { FailureCause, TrackingViewModel } from "@/lib/tracking/types";
import { ScreenAndReply } from "./ScreenAndReply";

const COLUMNS = ["조회번호", "상태 톤", "상태", "도착 예상", "걱정 기준일", "마지막 처리", "답변·화면"] as const;
const COPIED_LABEL = "복사했어요";
const EMPTY_CELL = "—";
const CELL_CLASS = "border-0 border-b border-solid border-tt-rule px-2 py-2 text-left align-top text-tt-sm [word-break:keep-all]";

export interface BulkResultTableProps {
  /** Rows in display order (sortBulkRows). */
  readonly rows: readonly BulkRow[];
  /** CS replies by number, built when each row settled. */
  readonly replies: Readonly<Record<string, CsReply>>;
  readonly expanded: string | null;
  readonly onToggle: (number: string) => void;
}

function failureCauseOf(row: BulkRow): FailureCause | undefined {
  return row.outcome?.kind === "failure" ? row.outcome.cause : undefined;
}

interface SettledCellsProps {
  readonly view: TrackingViewModel;
  readonly reply: CsReply | undefined;
  readonly open: boolean;
  readonly detailId: string;
  readonly onToggle: () => void;
}

function SettledCells({ view, reply, open, detailId, onToggle }: SettledCellsProps): React.JSX.Element {
  const summary = summarizeBulkView(view);
  return (
    <>
      <td className={CELL_CLASS}>
        <StatusChip tone={view.tone} text={summary.toneLabel} />
      </td>
      <td className={CELL_CLASS}>{summary.title}</td>
      <td className={CELL_CLASS}>
        {summary.eta ?? EMPTY_CELL}
        {summary.etaNote === null ? null : <span className="block text-tt-xs text-tt-muted">{summary.etaNote}</span>}
      </td>
      <td className={CELL_CLASS}>{summary.worryDate ?? EMPTY_CELL}</td>
      <td className={CELL_CLASS}>{summary.lastEvent ?? EMPTY_CELL}</td>
      <td className={CELL_CLASS}>
        <div className="flex min-w-[200px] flex-col items-start gap-2">
          {reply === undefined ? null : (
            <>
              <CopyButton mode="copy" text={reply.short} label="짧게 복사" copiedLabel={COPIED_LABEL} variant="secondary" />
              <CopyButton mode="copy" text={reply.long} label="자세히 복사" copiedLabel={COPIED_LABEL} variant="secondary" />
              <CopyButton mode="copy" text={reply.customerLink} label="고객 링크 복사" copiedLabel={COPIED_LABEL} variant="secondary" />
            </>
          )}
          <Button variant="text" aria-expanded={open} aria-controls={detailId} onClick={onToggle}>
            {open ? "화면 닫기" : "화면 보기"}
          </Button>
        </div>
      </td>
    </>
  );
}

/** 배송 안내 results (spec §10 ①): 톤 배지, 상태 제목, 도착 예상, 걱정 기준일, 마지막 처리; an open row shows the customer's screen. */
export function BulkResultTable({ rows, replies, expanded, onToggle }: BulkResultTableProps): React.JSX.Element | null {
  const baseId = useId();
  if (rows.length === 0) return null;
  return (
    <div className="max-w-full overflow-x-auto">
      <table data-bulk-table="true" className="w-full min-w-[960px] border-collapse bg-tt-surface text-tt-ink">
        <caption className="sr-only">조회 결과. 문제와 확인 필요가 위에 옵니다.</caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className={`${CELL_CLASS} font-bold`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const detailId = `${baseId}-${row.number}`;
            const reply: CsReply | undefined = replies[row.number];
            const open = expanded === row.number && row.view !== null && reply !== undefined;
            return (
              <Fragment key={row.number}>
                <tr data-bulk-row={row.number} data-bulk-status={row.status} data-tone={row.view?.tone}>
                  <th scope="row" className={`${CELL_CLASS} font-normal`}>
                    <span className="block whitespace-nowrap font-tt-mono text-tt-md font-bold">{compactTrackingNumber(row.number)}</span>
                    {row.view?.carrier.name ? <span className="block text-tt-xs text-tt-muted">{row.view.carrier.name}</span> : null}
                  </th>
                  {row.view === null ? (
                    <td colSpan={COLUMNS.length - 1} className={CELL_CLASS}>
                      {row.status === "running" ? "조회 중…" : "대기"}
                    </td>
                  ) : (
                    <SettledCells view={row.view} reply={reply} open={open} detailId={detailId} onToggle={() => onToggle(row.number)} />
                  )}
                </tr>
                {open && row.view !== null && reply !== undefined ? (
                  <tr data-bulk-detail={row.number}>
                    <td id={detailId} colSpan={COLUMNS.length} className={CELL_CLASS}>
                      <ScreenAndReply view={row.view} reply={reply} failureCause={failureCauseOf(row)} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
