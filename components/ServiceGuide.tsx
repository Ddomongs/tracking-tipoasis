import { AnimatedIcon } from "@/components/AnimatedIcon";
import type { AnimatedIconKind } from "@/components/AnimatedIcon";

const guideItems = [
  {
    title: "번호를 입력하세요",
    description: "숫자 운송장 또는 HBL 번호를 그대로 입력합니다.",
    visual: "lookup"
  },
  {
    title: "현재 단계를 확인하세요",
    description: "통관과 국내 배송 중 지금 어디에 있는지 한 번에 보여드립니다.",
    visual: "route"
  },
  {
    title: "필요할 때만 문의하세요",
    description: "배송 상태에 맞춰 재확인, 문의, 스토어 이동을 구분해 안내합니다.",
    visual: "inquiry"
  }
] as const satisfies readonly {
  title: string;
  description: string;
  visual: AnimatedIconKind;
}[];

export const ServiceGuide = () => (
  <section id="guide" aria-labelledby="guide-title" className="scroll-mt-24 py-12 sm:py-20">
    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <div className="max-w-lg">
        <p className="section-kicker">이용 안내</p>
        <h2 id="guide-title" className="section-title mt-3 text-2xl sm:text-3xl">
          기다리는 시간을 더 분명하게
        </h2>
        <p className="section-copy mt-4 text-sm sm:text-base">
          예상배송일은 최근 조회 이벤트를 바탕으로 계산한 안내값입니다. 통관 반영, 기상, 택배사 사정에 따라 실제
          도착일과 달라질 수 있습니다.
        </p>
      </div>

      <ol className="brand-panel overflow-hidden px-4 sm:px-6">
        {guideItems.map((item, index) => (
          <li key={item.title} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 border-b border-slate-700/70 py-5 last:border-b-0 sm:grid-cols-[3rem_1fr_auto]">
            <span className="font-mono text-sm font-semibold tabular-nums text-cyan-200">0{index + 1}</span>
            <div>
              <h3 className="text-base font-semibold text-slate-100">{item.title}</h3>
              <p className="mt-1 break-keep text-sm leading-6 text-slate-400">{item.description}</p>
            </div>
            <AnimatedIcon kind={item.visual} size="sm" delay={index === 0 ? "none" : index === 1 ? "short" : "long"} />
          </li>
        ))}
      </ol>
    </div>
  </section>
);
