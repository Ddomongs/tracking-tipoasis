import { parseInquiryCopy } from "@/lib/tracking/inquiry-copy";
import { normalizeInput, precheckNumber } from "@/lib/tracking/number-input";
import { formatKstDateTight } from "@/lib/tracking/time";
import type { EtaView, LookupOutcome, Tone, TrackingViewModel } from "@/lib/tracking/types";

// Internal-only (contract §11.1 rule 4): the CS desk's 배송 안내 tab (spec §10 ①). Up to 20 numbers per run, looked up
// one at a time so the per-IP limit of 60 per minute holds.

export const BULK_MAX = 20;
export const BULK_MIN_INTERVAL_MS = 1000;

export interface BulkRow {
  readonly number: string;
  readonly status: "queued" | "running" | "done";
  readonly outcome: LookupOutcome | null;
  readonly view: TrackingViewModel | null;
}

export interface BulkParseResult {
  /** Normalized, unique, in pasted order, at most BULK_MAX. */
  readonly numbers: readonly string[];
  /** Lines with digits that are not a tracking number (or look like a phone), as staff wrote them. */
  readonly rejected: readonly string[];
  /** True when more than BULK_MAX numbers were pasted. */
  readonly truncated: boolean;
}

/** Line breaks, commas, semicolons and tabs separate entries. */
const ENTRY_SEPARATOR = /\r\n|[\n\r,;\t]/;
const HAS_DIGIT = /[0-9０-９]/;
const INQUIRY_LABEL = "조회번호";
/** A line that is only the '조회번호' label; the number follows on the next line. */
const LABEL_ONLY = /^조회번호[\s:：]*$/;
/** Korean mobile numbers after normalizeInput (+82 allowed): never looked up as a tracking number. */
const PHONE_DIGITS = /^(?:82)?0?1[016789]\d{7,8}$/;

function isPhoneLike(line: string): boolean {
  return PHONE_DIGITS.test(normalizeInput(line).replace(/^\+/, ""));
}

function numberFromLine(line: string): string | null {
  if (line.includes(INQUIRY_LABEL)) return parseInquiryCopy(line)?.number ?? null;
  if (isPhoneLike(line)) return null;
  const checked = precheckNumber(line);
  return checked.ok ? checked.number : null;
}

/** Reads a paste: one number per line (or comma/semicolon/tab), the customer's '[배송 문의] …' copy included. */
export function parseBulkInput(text: string): BulkParseResult {
  const numbers: string[] = [];
  const rejected: string[] = [];
  let truncated = false;
  for (const part of text.split(ENTRY_SEPARATOR)) {
    const line = part.trim();
    if (line === "" || LABEL_ONLY.test(line) || !HAS_DIGIT.test(line)) continue;
    const number = numberFromLine(line);
    if (number === null) {
      rejected.push(line);
    } else if (!numbers.includes(number)) {
      if (numbers.length < BULK_MAX) numbers.push(number);
      else truncated = true;
    }
  }
  return { numbers, rejected, truncated };
}

export function queuedRow(number: string): BulkRow {
  return { number, status: "queued", outcome: null, view: null };
}

export function initialBulkRows(numbers: readonly string[]): readonly BulkRow[] {
  return numbers.map(queuedRow);
}

/** 문제 first, then 확인 필요, then every other settled row, then rows still waiting; the pasted order inside each group. */
const TONE_RANK: Readonly<Partial<Record<Tone, number>>> = { problem: 0, attention: 1 };
const SETTLED_RANK = 2;
const WAITING_RANK = 3;

function rankOf(row: BulkRow): number {
  if (row.view === null) return WAITING_RANK;
  return TONE_RANK[row.view.tone] ?? SETTLED_RANK;
}

export function sortBulkRows(rows: readonly BulkRow[]): readonly BulkRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => rankOf(a.row) - rankOf(b.row) || a.index - b.index)
    .map(({ row }) => row);
}

/** The tone names of spec §6 ('neutral' only appears while a row has no result). */
export const TONE_LABELS: Readonly<Record<Tone, string>> = {
  neutral: "확인 중",
  progress: "정상 진행",
  waiting: "정보 대기",
  attention: "확인 필요",
  problem: "문제",
  done: "완료"
};

export interface BulkRowSummary {
  readonly toneLabel: string;
  readonly title: string;
  readonly eta: string | null;
  readonly etaNote: string | null;
  readonly worryDate: string | null;
  readonly lastEvent: string | null;
}

function etaCell(eta: EtaView): Pick<BulkRowSummary, "eta" | "etaNote"> {
  switch (eta.kind) {
    case "none":
      return { eta: null, etaNote: null };
    case "date":
      return { eta: `${eta.date.label} · D-${eta.dday}`, etaNote: eta.caption };
    case "today":
      return { eta: `${eta.label} · ${eta.date.label}`, etaNote: eta.caption };
    case "holidayAffected":
      return { eta: eta.date.label, etaNote: eta.badge };
    case "overdue":
    case "deliveredOn":
      return { eta: `${eta.label} ${eta.date.label}`, etaNote: null };
    case "pendingInfo":
    case "withheld":
    case "unknown":
      return { eta: eta.text, etaNote: null };
  }
}

/** One table row from the same view the customer sees (spec §10: 톤 배지, 상태 제목, 도착 예상, 걱정 기준일, 마지막 처리). */
export function summarizeBulkView(view: TrackingViewModel): BulkRowSummary {
  const worryKey = view.nextAction.worry?.dateKey ?? null;
  return {
    toneLabel: TONE_LABELS[view.tone],
    title: view.title,
    ...etaCell(view.eta),
    worryDate: worryKey === null ? null : formatKstDateTight(worryKey),
    lastEvent: view.lastEvent?.text ?? null
  };
}
