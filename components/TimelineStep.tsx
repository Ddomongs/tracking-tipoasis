import { cn } from "@/lib/utils";

type TimelineStepProps = {
  label: string;
  datetime?: string;
  state: "completed" | "current" | "pending";
  detail?: string;
};

const dotStyle: Record<TimelineStepProps["state"], string> = {
  completed: "bg-emerald-400",
  current: "bg-amber-300",
  pending: "bg-slate-500"
};

/** Legacy history row (deleted by S07). Static since S06: no animation-library entrance, no pulsing dot (spec §12 2.2.2). */
export const TimelineStep = ({ label, datetime, detail, state }: TimelineStepProps) => (
  <li className={cn("relative rounded-xl py-1 pl-8 pr-1", state === "current" && "bg-amber-200/[0.04]")}>
    <span className={cn("absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border border-slate-900", dotStyle[state])} />
    <span className="absolute left-[6px] top-6 h-[calc(100%-12px)] w-px bg-slate-700/80" aria-hidden="true" />
    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-100">
      <span>{label}</span>
      {state === "current" ? (
        <span className="rounded-md border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-xs font-semibold text-amber-100">
          현재
        </span>
      ) : null}
    </div>
    <time className="mt-1 block text-xs tabular-nums text-slate-300" dateTime={datetime}>
      {datetime ? new Date(datetime).toLocaleString("ko-KR") : "-"}
    </time>
    {detail ? <div className="mt-0.5 break-keep text-xs leading-5 text-slate-400">{detail}</div> : null}
  </li>
);
