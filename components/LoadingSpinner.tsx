import { Skeleton } from "@/components/ui/skeleton";

export const LoadingSpinner = () => (
  <div className="space-y-4">
    <Skeleton className="h-24 w-full rounded-2xl" />
    <div className="grid gap-4 lg:grid-cols-2">
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  </div>
);
