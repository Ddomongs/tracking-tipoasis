import { Card } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/AnimatedIcon";
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
    <Card className="h-full overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-700/70 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <AnimatedIcon kind="delivery" delay="short" />
          <div>
            <p className="section-kicker">국내 배송</p>
            <h3 className="text-base font-semibold text-slate-50">국내 배송 진행 상황</h3>
          </div>
        </div>
        <div className="max-w-28 text-right">
          <p className="truncate text-xs text-slate-400">{delivery.carrier}</p>
          <p className="mt-1 text-[11px] font-semibold text-cyan-200">{latestFirst.length}건</p>
        </div>
      </div>
      <ul className="space-y-4 p-4 sm:p-5">
        {assignedContactEvent ? (
          <li className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-3 text-xs text-amber-50 sm:text-sm">
            <p className="font-semibold text-amber-100">배송 담당 안내</p>
            {assignedContactEvent.driverName ? <p>{`배송 담당자: ${assignedContactEvent.driverName}`}</p> : null}
            {assignedContactEvent.driverPhone ? <p>{`연락처: ${assignedContactEvent.driverPhone}`}</p> : null}
            <p className="mt-1 text-amber-100/90">배송 문의는 배송담당자에게 문의해주세요.</p>
          </li>
        ) : null}
        {latestFirst.length === 0 ? (
          <li className="break-keep rounded-xl border border-slate-700/70 bg-slate-900/45 px-3 py-3 text-sm text-slate-400">
            <p>{waitingMessage ?? "표시할 배송 정보가 없습니다."}</p>
            {delivery.trackingUrl ? (
              <a
                href={delivery.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 font-semibold text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-300/15"
                aria-label={`${delivery.carrier} 공식 배송조회 새 창으로 열기`}
              >
                {delivery.carrier} 공식 조회에서 확인하기
              </a>
            ) : null}
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
