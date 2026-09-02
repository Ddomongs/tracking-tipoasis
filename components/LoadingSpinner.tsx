import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedIcon } from "@/components/AnimatedIcon";

export const LoadingSpinner = () => (
  <div className="space-y-4">
    <div className="brand-panel flex items-center gap-4 px-4 py-4 sm:px-6">
      <AnimatedIcon kind="result" size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-100">통관·배송 정보를 연결하고 있어요</p>
        <p className="mt-1 text-xs text-slate-400">최신 조회 내역을 확인하는 동안 잠시만 기다려 주세요.</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
          <span className="motion-loading-bar block h-full w-1/3 rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" />
        </div>
      </div>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  </div>
);
