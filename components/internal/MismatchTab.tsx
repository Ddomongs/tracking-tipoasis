"use client";

import { useId, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/primitives/Button";
import { CopyButton } from "@/components/primitives/CopyButton";
import {
  MISMATCH_KEEP_DAYS,
  clearAllStoredRecords,
  createRecordId,
  getRetentionSnapshot,
  getServerRetentionSnapshot,
  getServerStoredRecordsSnapshot,
  getStoredRecordsSnapshot,
  normalizePhone,
  setKeepInBrowser,
  subscribeStoredRecords,
  withRecordStatus,
  writeStoredRecords,
  type MismatchRecord,
  type MismatchStatus
} from "@/lib/cs/mismatch-storage";
import { CUSTOMS_MISMATCH_TEMPLATES, type CustomsMismatchTemplateKey } from "@/lib/cs/mismatch-templates";
import { formatKstDateTime, parseInstant } from "@/lib/tracking/time";
import { MismatchRecordList } from "./MismatchRecordList";
import { ERROR_CLASS, FIELD_CLASS, HELP_CLASS, LABEL_CLASS, PANEL_CLASS, SECTION_TITLE_CLASS } from "./ui";

const TEMPLATE_OPTIONS: readonly { readonly key: CustomsMismatchTemplateKey; readonly label: string }[] = [
  { key: "default", label: "통관부호 불일치 안내" },
  { key: "recipient", label: "수취인 정보 확인 요청" },
  { key: "hold", label: "출고보류 가능 안내" }
];
const STORAGE_REFUSED_MESSAGE = "이 브라우저에서는 목록을 저장할 수 없어요. 내용 복사 버튼으로 옮겨 주세요.";
const MISSING_FIELDS_MESSAGE = "휴대폰 번호와 안내 내용을 입력해주세요.";
const CLEAR_CONFIRM = "저장된 통관부호 불일치 안내를 모두 삭제할까요?";
const COPIED_LABEL = "복사했어요";
const KEEP_LABEL = `이 브라우저에 ${MISMATCH_KEEP_DAYS}일 보관`;
const TAB_ONLY_NOTE = `이 탭을 닫으면 목록이 지워져요. 오래 두려면 ${MISMATCH_KEEP_DAYS}일 보관을 켜 주세요.`;

function keptNote(keepUntil: string): string {
  const until = parseInstant(keepUntil);
  return until === null ? "" : `${formatKstDateTime(until)}까지 이 브라우저에 보관하고, 지나면 자동으로 지워요.`;
}

function isTemplateKey(value: string): value is CustomsMismatchTemplateKey {
  return TEMPLATE_OPTIONS.some((option) => option.key === value);
}

/** 통관부호 불일치 (spec §10 ②): write a draft from a template, keep a masked list with a status, copy by hand. */
export function MismatchTab(): React.JSX.Element {
  const baseId = useId();
  const records = useSyncExternalStore(subscribeStoredRecords, getStoredRecordsSnapshot, getServerStoredRecordsSnapshot);
  const retentionState = useSyncExternalStore(subscribeStoredRecords, getRetentionSnapshot, getServerRetentionSnapshot);
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [templateKey, setTemplateKey] = useState<CustomsMismatchTemplateKey>("default");
  const [content, setContent] = useState<string>(CUSTOMS_MISMATCH_TEMPLATES.default);
  const [error, setError] = useState("");

  const save = (next: readonly MismatchRecord[]): boolean => {
    try {
      writeStoredRecords(next);
      setError("");
      return true;
    } catch {
      setError(STORAGE_REFUSED_MESSAGE);
      return false;
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const normalized = normalizePhone(phone);
    const text = content.trim();
    if (normalized === "" || text === "") {
      setError(MISSING_FIELDS_MESSAGE);
      return;
    }
    const record: MismatchRecord = {
      id: createRecordId(),
      phone: normalized,
      content: text,
      trackingMemo: memo.trim(),
      templateKey,
      status: "draft",
      createdAt: new Date().toISOString()
    };
    if (!save([record, ...records])) return;
    setPhone("");
    setMemo("");
  };

  const onTemplate = (value: string): void => {
    if (!isTemplateKey(value)) return;
    setTemplateKey(value);
    setContent(CUSTOMS_MISMATCH_TEMPLATES[value]);
  };

  const onStatus = (id: string, status: MismatchStatus): void => {
    save(withRecordStatus(records, id, status, new Date()));
  };

  const onDelete = (id: string): void => {
    save(records.filter((record) => record.id !== id));
  };

  const onClearAll = (): void => {
    if (window.confirm(CLEAR_CONFIRM)) clearAllStoredRecords();
  };

  const onKeepChange = (keep: boolean): void => {
    try {
      setKeepInBrowser(keep, new Date());
      setError("");
    } catch {
      setError(STORAGE_REFUSED_MESSAGE);
    }
  };

  const retention = (
    <div data-mismatch-retention={retentionState.kind} className="flex flex-col gap-1">
      <label className="flex min-h-[44px] items-center gap-2 text-tt-md font-bold">
        <input
          type="checkbox"
          checked={retentionState.kind === "kept"}
          onChange={(event) => onKeepChange(event.target.checked)}
          className="tt-focus h-6 w-6"
        />
        {KEEP_LABEL}
      </label>
      <p className={HELP_CLASS}>{retentionState.kind === "kept" ? keptNote(retentionState.keepUntil) : TAB_ONLY_NOTE}</p>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
      <form onSubmit={onSubmit} noValidate aria-labelledby={`${baseId}-title`} className={PANEL_CLASS}>
        <h2 id={`${baseId}-title`} className={SECTION_TITLE_CLASS}>
          불일치 안내 작성
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${baseId}-phone`} className={LABEL_CLASS}>
              휴대폰 번호
            </label>
            <input
              id={`${baseId}-phone`}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="010-0000-0000"
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${baseId}-memo`} className={LABEL_CLASS}>
              운송장/주문 메모
            </label>
            <input
              id={`${baseId}-memo`}
              autoComplete="off"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="선택 입력"
              className={FIELD_CLASS}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${baseId}-template`} className={LABEL_CLASS}>
            안내 템플릿
          </label>
          <select id={`${baseId}-template`} value={templateKey} onChange={(event) => onTemplate(event.target.value)} className={FIELD_CLASS}>
            {TEMPLATE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${baseId}-content`} className={LABEL_CLASS}>
            발송 예정 내용
          </label>
          <textarea
            id={`${baseId}-content`}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={8}
            className={FIELD_CLASS}
          />
        </div>
        {error === "" ? null : (
          <p role="alert" className={ERROR_CLASS}>
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-start gap-2">
          <Button type="submit" variant="primary">
            저장
          </Button>
          <CopyButton mode="copy" text={content} label="내용 복사" copiedLabel={COPIED_LABEL} variant="secondary" />
        </div>
      </form>
      <MismatchRecordList records={records} retention={retention} onStatus={onStatus} onDelete={onDelete} onClearAll={onClearAll} />
    </div>
  );
}
