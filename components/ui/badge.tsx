import { cn } from "@/lib/utils";

const toneClass = {
  success: "bg-emerald-300/20 text-emerald-200 border-emerald-300/40",
  warning: "bg-amber-300/20 text-amber-200 border-amber-300/40",
  info: "bg-cyan-300/20 text-cyan-100 border-cyan-300/40",
  neutral: "bg-slate-500/20 text-slate-200 border-slate-400/40"
} as const;

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: keyof typeof toneClass;
};

export const Badge = ({ className, tone = "neutral", ...props }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
      toneClass[tone],
      className
    )}
    {...props}
  />
);
