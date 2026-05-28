import { cn } from "@/lib/utils";

export const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "rounded-2xl border border-slate-700/70 bg-slate-900/55 p-5 shadow-[0_18px_50px_rgba(2,8,23,0.55)] backdrop-blur-md",
      className
    )}
    {...props}
  />
);
