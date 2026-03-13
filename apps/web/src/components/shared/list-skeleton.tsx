import { Skeleton } from "@/components/ui/skeleton";

interface ListSkeletonProps {
  rows?: number;
}

export function ListSkeleton({ rows = 3 }: ListSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-6 py-3 border-b border-border"
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-16 ml-auto" />
        </div>
      ))}
    </>
  );
}
