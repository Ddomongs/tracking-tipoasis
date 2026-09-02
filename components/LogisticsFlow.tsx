import { AnimatedIcon } from "@/components/AnimatedIcon";
import type { AnimatedIconKind } from "@/components/AnimatedIcon";

const stages = [
  { number: "01", label: "해외 이동", detail: "출발지에서 이동", kind: "route", delay: "none" },
  { number: "02", label: "통관 진행", detail: "UNI-PASS 확인", kind: "customs", delay: "short" },
  { number: "03", label: "국내 배송", detail: "택배사 인계", kind: "delivery", delay: "long" }
] as const satisfies readonly {
  number: string;
  label: string;
  detail: string;
  kind: AnimatedIconKind;
  delay: "none" | "short" | "long";
}[];

export const LogisticsFlow = () => (
  <section
    data-logistics-flow="true"
    aria-label="해외 이동부터 통관, 국내 배송까지 진행 흐름"
    className="relative mt-6 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/35 px-3 py-4 sm:mt-8 sm:px-5"
  >
    <div className="pointer-events-none absolute left-[16.5%] right-[16.5%] top-[2.1rem] h-px bg-gradient-to-r from-cyan-300/20 via-cyan-200/70 to-emerald-300/30" aria-hidden="true">
      <span className="motion-logistics-packet absolute -top-1.5 h-3 w-1/3" />
    </div>
    <ol className="relative grid grid-cols-3 gap-2">
      {stages.map((stage) => (
        <li key={stage.number} className="flex min-w-0 flex-col items-center text-center sm:items-start sm:text-left">
          <AnimatedIcon kind={stage.kind} size="sm" delay={stage.delay} className="bg-slate-950" />
          <p className="mt-3 font-mono text-[10px] font-semibold tabular-nums text-cyan-200 sm:text-xs">{stage.number}</p>
          <p className="mt-1 break-keep text-xs font-semibold text-slate-200 sm:text-sm">{stage.label}</p>
          <p className="mt-0.5 hidden text-[11px] text-slate-500 sm:block">{stage.detail}</p>
        </li>
      ))}
    </ol>
  </section>
);
