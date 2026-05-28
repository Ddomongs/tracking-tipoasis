import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { StatusCode } from "@/lib/types";
import { CheckCircle2, Clock3, PackageCheck, ShipWheel } from "lucide-react";

const toneByCode: Record<StatusCode, "success" | "warning" | "info" | "neutral"> = {
  1: "info",
  2: "warning",
  3: "warning",
  4: "success",
  5: "info",
  6: "warning",
  7: "success"
};

type StatusBannerProps = {
  status: string;
  code: StatusCode;
  isPending?: boolean;
};

const iconByCode: Record<StatusCode, typeof ShipWheel> = {
  1: ShipWheel,
  2: Clock3,
  3: Clock3,
  4: CheckCircle2,
  5: PackageCheck,
  6: PackageCheck,
  7: CheckCircle2
};

export const StatusBanner = ({ status, code, isPending }: StatusBannerProps) => (
  <Card className="space-y-3 border-cyan-300/20 bg-gradient-to-r from-slate-900/70 to-slate-800/40">
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
          {(() => {
            const Icon = iconByCode[code];
            return <Icon size={20} />;
          })()}
        </span>
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-slate-400">현재 상태</p>
          <p className="text-lg font-semibold text-slate-50 sm:text-xl">{status}</p>
        </div>
      </div>
      <Badge tone={toneByCode[code]}>{isPending ? "대기" : `STEP ${code}`}</Badge>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300"
        style={{ width: `${isPending ? 0 : (code / 7) * 100}%` }}
      />
    </div>
  </Card>
);
