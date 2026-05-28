import { cn } from "@/lib/utils";

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive";
};

export const Alert = ({ className, variant = "default", ...props }: AlertProps) => (
  <div
    className={cn(
      "rounded-md border px-4 py-3 text-sm",
      variant === "default" && "border-sky-500/40 bg-sky-500/10 text-sky-100",
      variant === "destructive" && "border-rose-500/40 bg-rose-500/10 text-rose-100",
      className
    )}
    {...props}
  />
);
