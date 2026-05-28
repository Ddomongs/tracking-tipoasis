"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TrackResponseData } from "@/lib/types";

type ApiSuccess = { success: true; data: TrackResponseData };
type ApiFailure = { success: false; error: { code: string; message: string } };
type ApiResponse = ApiSuccess | ApiFailure;

type TrackingFormProps = {
  onSuccess: (data: TrackResponseData) => void;
  onError: (message: string) => void;
  onLoading: (loading: boolean) => void;
  initialTrackingNumber?: string;
};

export const TrackingForm = ({ onSuccess, onError, onLoading, initialTrackingNumber }: TrackingFormProps) => {
  const [value, setValue] = useState(initialTrackingNumber ?? "");
  const [submitting, setSubmitting] = useState(false);
  const sampleNumbers = ["509493884901", "509493884853"];
  const initialSubmittedRef = useRef<string>("");

  const submitTracking = useCallback(
    async (trackingNumber: string) => {
      if (!trackingNumber.trim()) {
        onError("조회번호를 입력해주세요");
        return;
      }

      onLoading(true);
      setSubmitting(true);
      onError("");

      try {
        const response = await fetch("/api/track", {
          method: "POST",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trackingNumber })
        });

        const payload = (await response.json()) as ApiResponse;
        if (!payload.success) {
          onError(payload.error.message);
          return;
        }

        onSuccess(payload.data);
      } catch {
        onError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요");
      } finally {
        onLoading(false);
        setSubmitting(false);
      }
    },
    [onError, onLoading, onSuccess]
  );

  useEffect(() => {
    if (!initialTrackingNumber) return;

    const normalized = initialTrackingNumber.trim();
    if (!normalized) return;

    setValue(normalized);

    if (initialSubmittedRef.current === normalized) return;

    initialSubmittedRef.current = normalized;
    void submitTracking(normalized);
  }, [initialTrackingNumber, submitTracking]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      window.history.pushState(null, "", `/${encodeURIComponent(trimmed)}`);
    }
    await submitTracking(value);
  };

  return (
    <div className="pointer-events-auto space-y-3">
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={onSubmit}>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="운송장 / HBL 번호를 입력하세요"
          aria-label="조회번호"
          disabled={submitting}
        />
        <Button type="submit" className="sm:w-36" disabled={submitting}>
          {submitting ? "조회중..." : "조회하기"}
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {sampleNumbers.map((sample) => (
          <button
            key={sample}
            type="button"
            onClick={() => setValue(sample)}
            className="rounded-full border border-slate-600/80 bg-slate-900/40 px-3 py-1 text-[11px] font-medium text-slate-200 transition hover:border-cyan-300/50 hover:text-cyan-100"
          >
            예시 {sample}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        숫자 운송장 또는 HBL 형식을 지원합니다. 예) 509493884901, ABCD1234567890
      </p>
      <p className="text-[11px] text-slate-500">
        참고: UNI-PASS 통관조회는 HBL/화물관리번호에서만 동작하며, 국내 운송장은 택배사 배송조회 기준으로 표시됩니다.
      </p>
    </div>
  );
};
