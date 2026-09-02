import { AnimatedIcon } from "@/components/AnimatedIcon";
import type { AnimatedIconKind } from "@/components/AnimatedIcon";

const assurances = [
  {
    title: "통관·국내 배송 한눈에",
    description: "UNI-PASS와 주요 택배사 배송 흐름을 함께 확인합니다.",
    visual: "route"
  },
  {
    title: "조회에 필요한 번호만 입력",
    description: "입력한 번호로 배송 정보를 확인합니다.",
    visual: "lookup"
  },
  {
    title: "막히면 바로 문의",
    description: "상태에 맞는 다음 행동과 문의 경로를 안내합니다.",
    visual: "inquiry"
  }
] as const satisfies readonly {
  title: string;
  description: string;
  visual: AnimatedIconKind;
}[];

export const AssuranceRail = () => (
  <section
    aria-label="배송 조회 안심 안내"
    className="grid overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/45 sm:grid-cols-3"
  >
    {assurances.map(({ title, description, visual }, index) => (
      <div
        key={title}
        className={`flex gap-3 px-4 py-4 sm:px-5 ${index > 0 ? "border-t border-slate-700/70 sm:border-l sm:border-t-0" : ""}`}
      >
        <AnimatedIcon kind={visual} size="sm" delay={index === 0 ? "none" : index === 1 ? "short" : "long"} />
        <div className="min-w-0">
          <p className="break-keep text-sm font-semibold text-slate-100">{title}</p>
          <p className="mt-1 break-keep text-xs leading-5 text-slate-400">{description}</p>
        </div>
      </div>
    ))}
  </section>
);
