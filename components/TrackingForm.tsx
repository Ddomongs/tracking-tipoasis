"use client";

import { ArrowRight, ChevronsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookup } from "@/config/site.config";
import { DELIVERY_CARRIER_OPTIONS, DeliveryCarrierCodeSchema } from "@/lib/delivery-carriers";
import type { DeliveryCarrierCode } from "@/lib/types";
import { cn } from "@/lib/utils";

// Transitional (deleted by S06). Controlled by HomePageClient, which owns the lookup (useLookup). While a lookup runs nothing is
// disabled: the form is aria-busy and the button reads '조회 중…'; a new submit replaces the running lookup (spec §5).

type TrackingFormProps = {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly carrier: DeliveryCarrierCode;
  readonly onCarrierChange: (carrier: DeliveryCarrierCode) => void;
  readonly onSubmit: () => void;
  readonly busy: boolean;
  /** True while the slot under the form shows the invalid-number sentence (rendered by FailureNotice with this id). */
  readonly invalid: boolean;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly surface?: "dark" | "light";
};

/** id of the invalid-number sentence (role="alert") that the input names in aria-describedby. */
export const INVALID_NUMBER_ERROR_ID = "tracking-invalid-error";
const TRACKING_HELP_ID = "tracking-format-help";
const TRACKING_INPUT_CUE_ID = "tracking-input-cue";

export const TrackingForm = ({
  value,
  onValueChange,
  carrier,
  onCarrierChange,
  onSubmit,
  busy,
  invalid,
  inputRef,
  surface = "dark"
}: TrackingFormProps) => {
  const isLight = surface === "light";
  const needsInputAttention = value.trim().length === 0 && !busy;
  const describedBy = invalid
    ? `${TRACKING_INPUT_CUE_ID} ${TRACKING_HELP_ID} ${INVALID_NUMBER_ERROR_ID}`
    : `${TRACKING_INPUT_CUE_ID} ${TRACKING_HELP_ID}`;

  return (
    <div className="pointer-events-auto space-y-4">
      <form
        className="space-y-4"
        aria-busy={busy || undefined}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div>
          <label htmlFor="delivery-carrier" className={cn("block text-sm font-semibold", isLight ? "text-slate-800" : "text-slate-100")}>
            국내 택배사
          </label>
          <select
            id="delivery-carrier"
            name="carrierCode"
            value={carrier}
            onChange={(event) => {
              const parsed = DeliveryCarrierCodeSchema.safeParse(event.target.value);
              if (parsed.success) onCarrierChange(parsed.data);
            }}
            className={cn(
              "mt-2 h-14 w-full min-w-0 rounded-xl border px-4 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-400/70",
              isLight
                ? "border-slate-300 bg-slate-50 text-slate-800 hover:border-cyan-400"
                : "border-slate-600/80 bg-slate-950/60 text-slate-100 hover:border-cyan-300/60"
            )}
          >
            {DELIVERY_CARRIER_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.code === "AUTO" ? "자동으로 찾기" : option.name}
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
                ref={inputRef}
                id="tracking-number"
                name="trackingNumber"
                data-input-shake={needsInputAttention ? "active" : "idle"}
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                placeholder="여기에 운송장 / HBL 번호를 입력하세요"
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                required
                autoComplete="off"
                autoCapitalize="characters"
                enterKeyHint="search"
                inputMode="text"
                spellCheck={false}
                className={cn(
                  "h-14 text-base font-semibold",
                  isLight
                    ? "border-cyan-400 bg-white text-slate-950 placeholder:text-slate-500 focus-visible:ring-cyan-500/60"
                    : "border-cyan-300/60",
                  needsInputAttention && "motion-input-attention"
                )}
              />
            </div>
            <Button type="submit" className="gap-2 sm:w-36">
              {busy ? (
                lookup.copy.submitting
              ) : (
                <>
                  {lookup.copy.submit}
                  <ArrowRight data-motion-cue="tracking-submit" className="motion-cue-right h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
      <p id={TRACKING_HELP_ID} className={cn("break-keep text-xs leading-5", isLight ? "text-slate-600" : "text-slate-400")}>
        {lookup.copy.formatHint}
      </p>
      <p className="text-xs leading-5 text-slate-500">
        참고: UNI-PASS 통관조회는 HBL/화물관리번호에서만 동작하며, 국내 운송장은 택배사 배송조회 기준으로 표시됩니다.
      </p>
    </div>
  );
};
