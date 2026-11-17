import Link from 'next/link';
import SeriesCard from './SeriesCard';
import type { SeriesCardData } from '../lib/series-card';

interface CategorySectionProps {
  /** Display pill label above the title, e.g. "Popular". */
  pill?: string;
  title: string;
  description?: string;
  series: SeriesCardData[];
  /** Optional "View all →" target (usually /library). */
  viewAllHref?: string;
  /** Shown when the rail is empty (e.g. a signed-in user's empty library). */
  emptyMessage?: string;
}

/**
 * A single home-page category rail: a titled, horizontally-scrolling row of the
 * same SeriesCard used in the library grid. Kept server-rendered (no client JS)
 * — horizontal scroll is plain CSS, so it stays fast and works without hydration.
 */
export default function CategorySection({
  pill,
  title,
  description,
  series,
  viewAllHref,
  emptyMessage,
}: CategorySectionProps) {
  const hasItems = series.length > 0;

  return (
    <section className="space-y-4" aria-label={title}>
      <div className="flex items-end justify-between gap-4">
        <div>
          {pill ? <p className="section-pill mb-2">{pill}</p> : null}
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
          ) : null}
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="shrink-0 text-xs font-medium text-brand hover:underline dark:text-brand-accent sm:text-sm"
          >
            View all →
          </Link>
        ) : null}
      </div>

      {hasItems ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          {series.map((item) => (
            <div
              key={item.id}
              className="w-[220px] shrink-0 snap-start sm:w-[240px]"
            >
              <SeriesCard series={item} />
            </div>
          ))}
        </div>
      ) : (
        <div className="info-card flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {emptyMessage ?? 'Nothing here yet.'}
          </p>
          {viewAllHref ? (
            <Link href="/library" className="btn-ghost mt-1">
              Browse the catalog
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
