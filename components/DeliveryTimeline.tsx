import { Card } from "@/components/ui/card";
import { TimelineStep } from "@/components/TimelineStep";
import type { DeliveryResult } from "@/lib/types";

type DeliveryTimelineProps = {
  delivery: DeliveryResult;
  waitingMessage?: string;
};

const makeReadable = (text?: string): string | undefined => {
  if (!text) return text;

  return text
    .replace(/통관목록심사완료/g, "통관 목록 심사 완료")
    .replace(/통관목록접수/g, "통관 목록 접수")
    .replace(/입항적재화물목록/g, "입항 적재 화물목록")
    .replace(/입항보고/g, "입항 보고")
    .replace(/하기신고/g, "하기 신고")
    .replace(/반입신고/g, "반입 신고")
    .replace(/반출신고/g, "반출 신고");
};

export const DeliveryTimeline = ({ delivery, waitingMessage }: DeliveryTimelineProps) => {
  const latestFirst = [...delivery.events].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
  const assignedContactEvent = latestFirst.find(
    (event) => Boolean(event.driverName || event.driverPhone) && /(배송출발|배달출발|배송예정)/.test(event.status)
  );

  return (
    <Card className="h-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-emerald-100">국내 배송 진행 상황</h3>
        <span className="text-xs text-slate-400">{delivery.carrier}</span>
      </div>
      <ul className="space-y-4">
        {assignedContactEvent ? (
          <li className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-3 text-xs text-amber-50 sm:text-sm">
            <p className="font-semibold text-amber-100">배송 담당 안내</p>
            {assignedContactEvent.driverName ? <p>{`배송 담당자: ${assignedContactEvent.driverName}`}</p> : null}
            {assignedContactEvent.driverPhone ? <p>{`연락처: ${assignedContactEvent.driverPhone}`}</p> : null}
            <p className="mt-1 text-amber-100/90">배송 문의는 배송담당자에게 문의해주세요.</p>
          </li>
        ) : null}
        {latestFirst.length === 0 ? (
          <li className="rounded-xl border border-slate-700/70 bg-slate-900/45 px-3 py-3 text-sm text-slate-400">
            {waitingMessage ?? "표시할 배송 정보가 없습니다."}
          </li>
        ) : (
          latestFirst.map((event, index) => (
            <TimelineStep
              key={`${event.status}-${event.datetime}-${index}`}
              label={makeReadable(event.status) ?? event.status}
              datetime={event.datetime}
              detail={makeReadable(event.detail) ?? makeReadable(event.location) ?? event.location}
              state={index === 0 ? "current" : "completed"}
            />
          ))
        )}
      </ul>
    </Card>
  );
};
