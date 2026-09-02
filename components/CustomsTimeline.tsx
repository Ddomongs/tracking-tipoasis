import { Card } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/AnimatedIcon";
import { TimelineStep } from "@/components/TimelineStep";
import type { TrackingEvent } from "@/lib/types";

type CustomsTimelineProps = {
  events: TrackingEvent[];
};

export const CustomsTimeline = ({ events }: CustomsTimelineProps) => {
  const latestFirst = [...events].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());

  return (
    <Card className="h-full overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-700/70 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <AnimatedIcon kind="customs" />
          <div>
            <p className="section-kicker">통관 조회</p>
            <h3 className="text-base font-semibold text-slate-50">통관 진행 상황</h3>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">UNI-PASS</p>
          <p className="mt-1 text-[11px] font-semibold text-cyan-200">{latestFirst.length}건</p>
        </div>
      </div>
      <ul className="space-y-4 p-4 sm:p-5">
        {latestFirst.length === 0 ? (
          <li className="rounded-xl border border-slate-700/70 bg-slate-900/45 px-3 py-3 text-sm text-slate-400">
            표시할 통관 정보가 없습니다.
          </li>
        ) : (
          latestFirst.map((event, index) => (
            <TimelineStep
              key={`${event.status}-${event.datetime}-${index}`}
              label={event.status}
              datetime={event.datetime}
              detail={event.detail || event.location}
              state={index === 0 ? "current" : "completed"}
            />
          ))
        )}
      </ul>
    </Card>
  );
};
