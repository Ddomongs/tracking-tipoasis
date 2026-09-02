import {
  DatabaseZap,
  Landmark,
  MessagesSquare,
  PackageSearch,
  Route,
  ShoppingBag,
  Sparkles,
  Store,
  Truck
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AnimatedIconKind =
  | "route"
  | "lookup"
  | "inquiry"
  | "customs"
  | "delivery"
  | "result"
  | "sparkles"
  | "store"
  | "shopping";

type AnimatedIconProps = {
  readonly kind: AnimatedIconKind;
  readonly size?: "sm" | "md" | "lg";
  readonly delay?: "none" | "short" | "long";
  readonly className?: string;
};

const iconByKind: Record<AnimatedIconKind, typeof Route> = {
  route: Route,
  lookup: DatabaseZap,
  inquiry: MessagesSquare,
  customs: Landmark,
  delivery: Truck,
  result: PackageSearch,
  sparkles: Sparkles,
  store: Store,
  shopping: ShoppingBag
};

const animationByKind: Record<AnimatedIconKind, string> = {
  route: "motion-visual-route",
  lookup: "motion-visual-scan",
  inquiry: "motion-visual-message",
  customs: "motion-visual-customs",
  delivery: "motion-visual-delivery",
  result: "motion-visual-search",
  sparkles: "motion-visual-sparkle",
  store: "motion-visual-store",
  shopping: "motion-visual-shopping"
};

const sizeClassName: Record<NonNullable<AnimatedIconProps["size"]>, string> = {
  sm: "h-9 w-9 rounded-[0.7rem] [&_svg]:h-4 [&_svg]:w-4",
  md: "h-11 w-11 rounded-xl [&_svg]:h-5 [&_svg]:w-5",
  lg: "h-14 w-14 rounded-2xl [&_svg]:h-6 [&_svg]:w-6"
};

const delayClassName: Record<NonNullable<AnimatedIconProps["delay"]>, string> = {
  none: "",
  short: "motion-visual-delay-short",
  long: "motion-visual-delay-long"
};

export const AnimatedIcon = ({ kind, size = "md", delay = "none", className }: AnimatedIconProps) => {
  const Icon = iconByKind[kind];

  return (
    <span
      data-motion-visual={kind}
      className={cn("motion-visual shrink-0", sizeClassName[size], delayClassName[delay], className)}
      aria-hidden="true"
    >
      <Icon className={cn("motion-visual-icon relative z-10", animationByKind[kind])} strokeWidth={1.8} />
    </span>
  );
};
