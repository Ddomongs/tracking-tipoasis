import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type TimelineStepProps = {
  label: string;
  datetime?: string;
  state: "completed" | "current" | "pending";
  detail?: string;
};

const dotStyle: Record<TimelineStepProps["state"], string> = {
  completed: "bg-emerald-400",
  current: "bg-amber-300 animate-pulse-glow",
  pending: "bg-slate-500"
};

export const TimelineStep = ({ label, datetime, detail, state }: TimelineStepProps) => (
  <motion.li
    className="relative pl-8"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25 }}
  >
    <span className={cn("absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border border-slate-900", dotStyle[state])} />
    <span className="absolute left-[6px] top-6 h-[calc(100%-12px)] w-px bg-slate-700/80" aria-hidden="true" />
    <div className="text-sm font-medium text-slate-100">{label}</div>
    <div className="text-xs text-slate-300">{datetime ? new Date(datetime).toLocaleString("ko-KR") : "-"}</div>
    {detail ? <div className="text-xs text-slate-400">{detail}</div> : null}
  </motion.li>
);
