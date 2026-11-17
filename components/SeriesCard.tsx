import Link from 'next/link';
import { isFormatTag } from '../lib/formats';
import type { SeriesCardData } from '../lib/series-card';

/** Demo badge is a dev affordance - never shown in a public production build. */
const showDemoBadge = process.env.NODE_ENV !== 'production';

const STATUS_STYLES: Record<SeriesCardData['status'], { dot: string; label: string }> = {
  ongoing: { dot: 'bg-emerald-400', label: 'Ongoing' },
  completed: { dot: 'bg-sky-400', label: 'Completed' },
  hiatus: { dot: 'bg-amber-400', label: 'Hiatus' },
};

/**
 * Tags that describe the source rather than the story. Atsumaru leads every
 * title with them, so using them in the card's two-genre summary would make
 * every card read "Manhwa · Aggregator". Format tags (manhwa / manhua / manga /
 * oel) are covered by `isFormatTag` so that list cannot drift from lib/formats.
 */
const NON_GENRE_TAGS = new Set(['aggregator', 'webtoon', 'comic', 'novel']);

function StatusBadge({ status }: { status: SeriesCardData['status'] }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.ongoing;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-950/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white shadow-sm backdrop-blur">
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}

/**
 * Poster-style series card shared by the library grid and the home rails.
 *
 * The cover is a fixed 2:3 portrait so book art is never cropped into a
 * landscape strip. Metadata below the poster stays to two tight lines; the
 * synopsis lives in a hover/focus reveal on the cover so the grid reads as a
 * shelf of covers rather than a wall of text.
 */
export default function SeriesCard({ series }: { series: SeriesCardData }) {
  const credit = series.author?.trim() || series.scanlatorLabels[0]?.trim() || 'Yoru library';
  const storyTags = series.tags.filter(
    (tag) => !isFormatTag(tag) && !NON_GENRE_TAGS.has(tag.toLowerCase()),
  );
  const genres = (storyTags.length ? storyTags : series.tags).slice(0, 2).join(' · ');

  return (
    <Link
      href={`/series/${series.id}`}
      title={series.title}
      className="group flex h-full min-w-0 flex-col gap-3 rounded-2xl outline-none transition duration-300 hover:-translate-y-1 focus-visible:-translate-y-1"
    >
      <div className="relative aspect-[2/3] min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-card transition duration-300 group-hover:border-brand/50 group-hover:shadow-[0_24px_60px_-22px_rgba(99,102,241,0.6)] dark:border-white/10 dark:bg-white/5">
        <img
          src={series.cover}
          alt={`${series.title} cover`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />

        {/* Scrim keeps badges and the hover synopsis legible over bright art. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/50 via-slate-950/5 to-transparent opacity-70 transition duration-300 group-hover:opacity-90" />

        <div className="absolute left-2.5 top-2.5 z-10 flex flex-col items-start gap-1.5">
          <StatusBadge status={series.status} />
          {showDemoBadge && series.isStaticDemo ? (
            <span className="rounded-full bg-amber-400/95 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950 shadow-sm">
              demo
            </span>
          ) : null}
        </div>

        <span
          title={`${series.chapterCount} ${series.chapterCount === 1 ? 'chapter' : 'chapters'}`}
          className="absolute right-2.5 top-2.5 z-10 rounded-full border border-white/15 bg-slate-950/75 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur"
        >
          {series.chapterCount}
          <span className="hidden sm:inline"> {series.chapterCount === 1 ? 'ch' : 'chs'}</span>
        </span>

        {/* Depth on hover: synopsis slides up from the cover's bottom edge. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 translate-y-3 bg-gradient-to-t from-slate-950/95 via-slate-950/80 to-transparent p-3 pt-10 opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <p className="line-clamp-3 text-[11px] leading-4 text-slate-200">{series.description}</p>
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-accent">
            Open series <span aria-hidden>→</span>
          </span>
        </div>
      </div>

      <div className="min-w-0 space-y-1 px-0.5">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-slate-900 transition group-hover:text-brand dark:text-white dark:group-hover:text-brand-accent">
          {series.title}
        </h3>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{credit}</p>
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="truncate capitalize">{genres || 'Yoru catalog'}</span>
          <span className="shrink-0 whitespace-nowrap">{series.updatedLabel}</span>
        </div>
      </div>
    </Link>
  );
}
