"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DELIVERY_CARRIER_OPTIONS, DeliveryCarrierCodeSchema } from "@/lib/delivery-carriers";
import { ApiTrackResponseSchema } from "@/lib/schemas";
import type { DeliveryCarrierCode, TrackResponseData } from "@/lib/types";
import { cn } from "@/lib/utils";

type TrackingFormProps = {
  readonly onSuccess: (data: TrackResponseData) => void;
  readonly onError: (message: string) => void;
  readonly onLoading: (loading: boolean) => void;
  readonly initialTrackingNumber?: string;
  readonly surface?: "dark" | "light";
};

const SAMPLE_NUMBERS = ["509493884901", "509493884853"] as const;
const TRACKING_HELP_ID = "tracking-format-help";
const TRACKING_INPUT_CUE_ID = "tracking-input-cue";

export const TrackingForm = ({
  onSuccess,
  onError,
  onLoading,
  initialTrackingNumber,
  surface = "dark"
}: TrackingFormProps) => {
  const [value, setValue] = useState(initialTrackingNumber ?? "");
  const [carrierCode, setCarrierCode] = useState<DeliveryCarrierCode>("AUTO");
  const [submitting, setSubmitting] = useState(false);
  const initialSubmittedRef = useRef<string>("");
  const isLight = surface === "light";
  const needsInputAttention = value.trim().length === 0 && !submitting;

  const submitTracking = useCallback(
    async (trackingNumber: string, selectedCarrier: DeliveryCarrierCode) => {
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
          body: JSON.stringify({ trackingNumber, carrierCode: selectedCarrier })
        });

        const payload = ApiTrackResponseSchema.parse(await response.json());
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
    void submitTracking(normalized, "AUTO");
  }, [initialTrackingNumber, submitTracking]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      window.history.pushState(null, "", `/${encodeURIComponent(trimmed)}`);
    }
    await submitTracking(value, carrierCode);
  };

  return (
    <div className="pointer-events-auto space-y-4">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label htmlFor="delivery-carrier" className={cn("block text-sm font-semibold", isLight ? "text-slate-800" : "text-slate-100")}>
            국내 택배사
          </label>
          <select
            id="delivery-carrier"
            name="carrierCode"
            value={carrierCode}
            onChange={(event) => {
              const parsed = DeliveryCarrierCodeSchema.safeParse(event.target.value);
              if (parsed.success) setCarrierCode(parsed.data);
            }}
            disabled={submitting}
            className={cn(
              "mt-2 h-14 w-full min-w-0 rounded-xl border px-4 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-400/70",
              isLight
                ? "border-slate-300 bg-slate-50 text-slate-800 hover:border-cyan-400"
                : "border-slate-600/80 bg-slate-950/60 text-slate-100 hover:border-cyan-300/60"
            )}
          >
            {DELIVERY_CARRIER_OPTIONS.map((carrier) => (
              <option key={carrier.code} value={carrier.code}>
                {carrier.code === "AUTO" ? "자동으로 찾기" : carrier.name}
              </option>
            ))}
          </select>
          <p className={cn("mt-2 text-xs", isLight ? "text-slate-600" : "text-slate-400")}>
            택배사를 모르시면 자동으로 찾기를 선택하세요.
          </p>
        </div>
        <div>
          <label htmlFor="tracking-number" className={cn("block text-sm font-semibold", isLight ? "text-slate-800" : "text-slate-100")}>
            조회번호 (HBL 또는 운송장)
          </label>
          <p
            id={TRACKING_INPUT_CUE_ID}
            data-input-attention-cue="true"
            className={cn(
              "mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-black shadow-sm transition",
              isLight ? "border-cyan-300 bg-cyan-50 text-cyan-800" : "border-cyan-200/35 bg-cyan-300/10 text-cyan-100",
              needsInputAttention && "motion-cue-pop"
            )}
          >
            운송장 번호는 바로 아래 칸에 넣어 주세요!
            <ChevronsDown
              data-motion-cue="tracking-input-pointer"
              className={cn("h-5 w-5 shrink-0", needsInputAttention && "motion-input-pointer")}
              aria-hidden="true"
            />
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <Input
                id="tracking-number"
                name="trackingNumber"
                data-input-shake={needsInputAttention ? "active" : "idle"}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="여기에 운송장 / HBL 번호를 입력하세요"
                aria-describedby={`${TRACKING_INPUT_CUE_ID} ${TRACKING_HELP_ID}`}
                autoComplete="off"
                inputMode="text"
                spellCheck={false}
                disabled={submitting}
                className={cn(
                  "h-14 text-base font-semibold",
                  isLight
                    ? "border-cyan-400 bg-white text-slate-950 placeholder:text-slate-500 focus-visible:ring-cyan-500/60"
                    : "border-cyan-300/60",
                  needsInputAttention && "motion-input-attention"
                )}
              />
            </div>
            <Button type="submit" className="gap-2 sm:w-36" disabled={submitting}>
              {submitting ? (
                "조회 중…"
              ) : (
                <>
                  조회하기
                  <ArrowRight data-motion-cue="tracking-submit" className="motion-cue-right h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
      <div className="flex flex-wrap gap-2">
        {SAMPLE_NUMBERS.map((sample) => (
          <button
            key={sample}
            type="button"
            onClick={() => setValue(sample)}
            className={cn(
              "min-h-11 rounded-xl border px-3 py-2 text-xs font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70",
              isLight
                ? "border-slate-300 bg-slate-100 text-slate-700 hover:border-cyan-500 hover:bg-cyan-50 hover:text-slate-950"
                : "border-slate-600/80 bg-slate-900/40 text-slate-200 hover:border-cyan-300/50 hover:text-cyan-100"
            )}
          >
            예시 {sample}
          </button>
        ))}
      </div>
      <p id={TRACKING_HELP_ID} className={cn("text-xs", isLight ? "text-slate-600" : "text-slate-400")}>
        숫자 운송장 또는 HBL 형식을 지원합니다. 예) 509493884901, ABCD1234567890
      </p>
      <p className="text-xs leading-5 text-slate-500">
        참고: UNI-PASS 통관조회는 HBL/화물관리번호에서만 동작하며, 국내 운송장은 택배사 배송조회 기준으로 표시됩니다.
      </p>
    </div>
  );
};
