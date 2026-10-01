"use client";

import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import {
  AlertTriangle,
  Check,
  Clipboard,
  Copy,
  MessageSquareText,
  PackageCheck,
  Save,
  Search,
  Send,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { siteConfig } from "@/config/site.config";
import { buildCsReply, type CsReply } from "@/lib/cs/cs-reply";
import { CUSTOMS_MISMATCH_TEMPLATES, type CustomsMismatchTemplateKey } from "@/lib/cs/mismatch-templates";
import {
  MISMATCH_TTL_DAYS,
  clearAllStoredRecords,
  createRecordId,
  getServerStoredRecordsSnapshot,
  getStoredRecordsSnapshot,
  normalizePhone,
  subscribeStoredRecords,
  writeStoredRecords,
  type MismatchRecord
} from "@/lib/cs/mismatch-storage";
import { classifyFailure } from "@/lib/tracking/classify-failure";
import { deriveTrackingView } from "@/lib/tracking/derive-view";
import { fetchTrack } from "@/lib/tracking/fetch-track";
import type { LookupOutcome, LookupRequest, TrackingViewModel } from "@/lib/tracking/types";

type ActiveTab = "delivery" | "mismatch";

const CustomsMismatchTemplateKeySchema = z.enum(["default", "recipient", "hold"]);
const STORAGE_REFUSED_MESSAGE = "이 브라우저에서는 목록을 저장할 수 없어요. 내용 복사 버튼으로 옮겨 주세요.";

/** One lookup's CS answer: the view model the customer would see and the reply built from it (spec §10). */
interface DeliveryGuide {
  readonly view: TrackingViewModel;
  readonly reply: CsReply;
}

/** The number shape the customer page sends (S09's desk takes S06's normalizeInput instead). */
const toLookupNumber = (value: string): string => value.trim().replace(/[\s-]/g, "").toUpperCase();

const copyText = async (text: string): Promise<boolean> => {
  if (!navigator.clipboard?.writeText) return false;
  await navigator.clipboard.writeText(text);
  return true;
};

export const InternalCsHelper = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("delivery");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [guide, setGuide] = useState<DeliveryGuide | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  const records = useSyncExternalStore(subscribeStoredRecords, getStoredRecordsSnapshot, getServerStoredRecordsSnapshot);
  const [templateKey, setTemplateKey] = useState<CustomsMismatchTemplateKey>("default");
  const [mismatchPhone, setMismatchPhone] = useState("");
  const [trackingMemo, setTrackingMemo] = useState("");
  const [mismatchContent, setMismatchContent] = useState<string>(CUSTOMS_MISMATCH_TEMPLATES.default);

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [records]
  );

  const setCopied = (key: string) => {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(""), 1500);
  };

  const handleCopy = async (key: string, text: string) => {
    try {
      const copied = await copyText(text);
      if (copied) {
        setCopied(key);
        setError("");
        return;
      }

      setError("복사에 실패했습니다. 내용을 직접 선택해 복사해주세요.");
    } catch {
      setError("복사에 실패했습니다. 내용을 직접 선택해 복사해주세요.");
    }
  };

  const handleTemplateChange = (nextKey: CustomsMismatchTemplateKey) => {
    setTemplateKey(nextKey);
    setMismatchContent(CUSTOMS_MISMATCH_TEMPLATES[nextKey]);
  };

  const handleDeliveryLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const number = toLookupNumber(invoiceNumber);
    if (!number) {
      setError("운송장번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setGuide(null);

    // Same path as the customer page: fetchTrack → deriveTrackingView → buildCsReply. A failed lookup gets the CS error
    // template, never the server's own message (spec §5, §10).
    const request: LookupRequest = { number, carrier: "AUTO", entry: "manual" };
    const result = await fetchTrack(request, { signal: new AbortController().signal, timeoutMs: siteConfig.lookup.timeoutMs });
    setLoading(false);
    if (result.kind === "aborted") return;
    const now = new Date();
    const outcome: LookupOutcome =
      result.kind === "success"
        ? { kind: "success", request, data: result.data }
        : { kind: "failure", request, cause: classifyFailure(result.input), consecutiveFailures: 1 };
    const view = deriveTrackingView(outcome, now, siteConfig);
    setGuide({ view, reply: buildCsReply(view, { now, notices: siteConfig.notices }) });
  };

  const saveRecords = (next: readonly MismatchRecord[]): boolean => {
    try {
      writeStoredRecords(next);
      return true;
    } catch {
      setError(STORAGE_REFUSED_MESSAGE);
      return false;
    }
  };

  const handleSaveMismatch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const phone = normalizePhone(mismatchPhone);
    const content = mismatchContent.trim();

    if (!phone || !content) {
      setError("휴대폰 번호와 안내 내용을 입력해주세요.");
      return;
    }

    const record: MismatchRecord = {
      id: createRecordId(),
      phone,
      content,
      trackingMemo: trackingMemo.trim(),
      templateKey,
      status: "draft",
      createdAt: new Date().toISOString()
    };
    if (!saveRecords([record, ...records])) return;
    setMismatchPhone("");
    setTrackingMemo("");
    setError("");
  };

  const handleDeleteRecord = (id: string) => {
    saveRecords(records.filter((record) => record.id !== id));
  };

  const handleClearAll = () => {
    if (!window.confirm("저장된 통관부호 불일치 안내를 모두 삭제할까요?")) return;
    clearAllStoredRecords();
  };

  return (
    <main className="pointer-events-auto mx-auto min-h-screen w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <section className="mb-5 flex flex-col gap-4 border-b border-slate-700/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Internal CS Desk</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50 sm:text-4xl">배송·통관 CS 안내 도구</h1>
          <p className="mt-2 max-w-2xl break-keep text-sm leading-6 text-slate-300">
            운송장 기반 배송 안내문을 만들고, 통관부호 불일치 안내 대상은 문자 발송 준비 목록으로 관리합니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700/70 bg-slate-950/50 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("delivery");
              setError("");
            }}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
              activeTab === "delivery" ? "bg-emerald-300 text-slate-950" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <PackageCheck className="h-4 w-4" aria-hidden="true" />
            배송 안내
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("mismatch");
              setError("");
            }}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
              activeTab === "mismatch" ? "bg-amber-300 text-slate-950" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            통관부호 불일치
          </button>
        </div>
      </section>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {activeTab === "delivery" ? (
        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-slate-700/80 bg-slate-950/55">
            <form onSubmit={handleDeliveryLookup} className="space-y-4">
              <div>
                <label htmlFor="invoiceNumber" className="text-sm font-semibold text-slate-100">
                  운송장번호
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="invoiceNumber"
                    inputMode="numeric"
                    value={invoiceNumber}
                    onChange={(event) => setInvoiceNumber(event.target.value)}
                    placeholder="예: 0000 1234 5678"
                    className="font-mono"
                  />
                  <Button type="submit" disabled={loading} className="shrink-0 gap-2">
                    <Search className="h-4 w-4" aria-hidden="true" />
                    {loading ? "조회중" : "조회"}
                  </Button>
                </div>
              </div>
            </form>
            <div className="mt-6 space-y-3 text-sm">
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-cyan-50">
                조회 결과와 복사 이력은 저장하지 않습니다.
              </div>
              <div className="break-keep rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3 text-slate-300">
                택배사 전산 반영 전이거나 국내 도착 전이면 보수적인 안내문을 생성합니다.
              </div>
            </div>
          </Card>

          <Card className="border-emerald-300/25 bg-slate-950/60">
            {guide ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs text-slate-400">택배사</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{guide.view.carrier.name ?? guide.view.carrier.barLabel}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs text-slate-400">운송장</p>
                    <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-100">{guide.view.number.raw}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs text-slate-400">상태</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{guide.view.title}</p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-100">고객 안내문</h2>
                    <Button type="button" variant="ghost" onClick={() => handleCopy("delivery", guide.reply.long)} className="h-9 gap-2">
                      {copiedKey === "delivery" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedKey === "delivery" ? "복사됨" : "복사"}
                    </Button>
                  </div>
                  <textarea
                    aria-label="고객 안내문"
                    readOnly
                    value={guide.reply.long}
                    className="min-h-44 w-full resize-none rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm leading-7 text-emerald-50 outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="flex min-h-80 items-center justify-center break-keep rounded-xl border border-dashed border-slate-700/80 bg-slate-900/45 p-6 text-center text-sm text-slate-400">
                운송장 조회 후 복사 가능한 고객 안내문이 여기에 표시됩니다.
              </div>
            )}
          </Card>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-amber-300/25 bg-slate-950/60">
            <form onSubmit={handleSaveMismatch} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="mismatchPhone" className="text-sm font-semibold text-slate-100">
                    휴대폰 번호
                  </label>
                  <Input
                    id="mismatchPhone"
                    value={mismatchPhone}
                    onChange={(event) => setMismatchPhone(event.target.value)}
                    placeholder="010-0000-0000"
                    className="mt-2"
                  />
                </div>
                <div>
                  <label htmlFor="trackingMemo" className="text-sm font-semibold text-slate-100">
                    운송장/주문 메모
                  </label>
                  <Input
                    id="trackingMemo"
                    value={trackingMemo}
                    onChange={(event) => setTrackingMemo(event.target.value)}
                    placeholder="선택 입력"
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="templateKey" className="text-sm font-semibold text-slate-100">
                  안내 템플릿
                </label>
                <select
                  id="templateKey"
                  value={templateKey}
                  onChange={(event) => {
                    const parsed = CustomsMismatchTemplateKeySchema.safeParse(event.target.value);
                    if (parsed.success) handleTemplateChange(parsed.data);
                  }}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-600/70 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                >
                  <option value="default">통관부호 불일치 안내</option>
                  <option value="recipient">수취인 정보 확인 요청</option>
                  <option value="hold">출고보류 가능 안내</option>
                </select>
              </div>

              <div>
                <label htmlFor="mismatchContent" className="text-sm font-semibold text-slate-100">
                  발송 예정 내용
                </label>
                <textarea
                  id="mismatchContent"
                  value={mismatchContent}
                  onChange={(event) => setMismatchContent(event.target.value)}
                  className="mt-2 min-h-52 w-full resize-y rounded-xl border border-slate-600/70 bg-slate-950/70 p-4 text-sm leading-7 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" className="gap-2">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  저장
                </Button>
                <Button type="button" variant="ghost" onClick={() => handleCopy("draft", mismatchContent)} className="gap-2">
                  <Clipboard className="h-4 w-4" aria-hidden="true" />
                  {copiedKey === "draft" ? "복사됨" : "내용 복사"}
                </Button>
              </div>
            </form>
          </Card>

          <Card className="border-slate-700/80 bg-slate-950/60">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">불일치 안내 목록</h2>
                <p className="mt-1 text-xs text-slate-400">{sortedRecords.length}건 저장됨</p>
                <p className="mt-1 break-keep text-xs text-slate-400">
                  이 브라우저에만 {MISMATCH_TTL_DAYS}일 동안 보관하고, 지나면 자동으로 지워요.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClearAll}
                  disabled={sortedRecords.length === 0}
                  className="h-9 gap-2 px-3"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  전체 삭제
                </Button>
                <MessageSquareText className="h-5 w-5 text-amber-200" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-3">
              {sortedRecords.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700/80 bg-slate-900/45 p-6 text-center text-sm text-slate-400">
                  저장된 통관부호 불일치 안내가 없습니다.
                </div>
              ) : (
                sortedRecords.map((record) => (
                  <article key={record.id} className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-amber-100">{record.phone}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {record.trackingMemo || "메모 없음"} · {new Date(record.createdAt).toLocaleString("ko-KR")}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleCopy(record.id, record.content)}
                          className="h-9 gap-2 px-3"
                        >
                          {copiedKey === record.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copiedKey === record.id ? "복사됨" : "복사"}
                        </Button>
                        <Button type="button" variant="ghost" disabled className="h-9 gap-2 px-3" title="카카오 알림톡 API 연동 예정">
                          <Send className="h-4 w-4" aria-hidden="true" />
                          알림톡 준비중
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => handleDeleteRecord(record.id)} className="h-9 gap-2 px-3">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          삭제
                        </Button>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-950/70 p-3 text-sm leading-6 text-slate-200">
                      {record.content}
                    </p>
                  </article>
                ))
              )}
            </div>
          </Card>
        </section>
      )}
    </main>
  );
};
