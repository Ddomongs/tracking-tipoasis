import { Card } from "@/components/ui/card";
import { TimelineStep } from "@/components/TimelineStep";
import type { TrackingEvent } from "@/lib/types";

type CustomsTimelineProps = {
  events: TrackingEvent[];
};

export const CustomsTimeline = ({ events }: CustomsTimelineProps) => {
  const latestFirst = [...events].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());

  return (
    <Card className="h-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-cyan-100">통관 진행상황</h3>
        <span className="text-xs text-slate-400">UNI-PASS</span>
      </div>
      <ul className="space-y-4">
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
