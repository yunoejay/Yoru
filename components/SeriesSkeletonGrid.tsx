function CardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="skeleton aspect-[2/3] w-full rounded-2xl" />
      <div className="space-y-2 px-0.5">
        <div className="skeleton h-4 w-5/6" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-3 w-2/3" />
      </div>
    </div>
  );
}

/**
 * Placeholder grid shown by the route-level loading boundaries (app/loading.tsx,
 * app/library/loading.tsx). Mirrors SeriesBrowser's sticky toolbar and portrait
 * poster grid so the skeleton morphs straight into the real cards without a
 * layout shift.
 */
export default function SeriesSkeletonGrid({ count = 10 }: { count?: number }) {
  return (
    <div className="space-y-6">
      <div className="library-toolbar space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="skeleton h-11 flex-1 rounded-xl" />
          <div className="flex flex-wrap gap-2">
            <div className="skeleton h-11 w-36 rounded-xl" />
            <div className="skeleton h-11 w-20 rounded-xl" />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200/80 pt-3 dark:border-white/10 lg:flex-row lg:items-start lg:gap-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-2.5">
            <div className="skeleton h-3 w-14 sm:mt-2" />
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-8 w-20 rounded-full" />
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:gap-2.5">
            <div className="skeleton h-3 w-12 sm:mt-2" />
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-8 w-20 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: count }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

