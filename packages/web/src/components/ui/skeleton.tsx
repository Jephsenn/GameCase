import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-neutral-800/60',
        className,
      )}
    />
  );
}

// ── Preset skeletons ───────────────────────────

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden">
      <Skeleton className="aspect-[3/4] rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function GameGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function LibraryCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-neutral-800 p-6 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-7 w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function RecommendationSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 flex gap-4">
          <Skeleton className="w-24 h-32 rounded-xl shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GameDetailSkeleton() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-neutral-800 p-6 sm:p-8 flex flex-col sm:flex-row gap-6">
        <Skeleton className="w-40 sm:w-48 aspect-[3/4] rounded-xl shrink-0" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-2/3" />
          <div className="flex gap-3">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-lg" />
            <Skeleton className="h-6 w-20 rounded-lg" />
            <Skeleton className="h-6 w-14 rounded-lg" />
          </div>
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}
