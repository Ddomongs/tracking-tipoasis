import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/80",
        variant === "default" &&
          "bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 text-slate-950 shadow-[0_10px_25px_rgba(45,212,191,0.35)] hover:brightness-110",
        variant === "ghost" && "bg-slate-800/40 text-slate-100 hover:bg-slate-700/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);

Button.displayName = "Button";
