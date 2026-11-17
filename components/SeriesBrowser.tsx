'use client';

import { useMemo, useState } from 'react';
import SeriesCard from './SeriesCard';
import type { SeriesCardData } from '../lib/series-card';

type SortKey = 'updated' | 'title' | 'chapters';

const STATUS_FILTERS = ['all', 'ongoing', 'completed', 'hiatus'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  ongoing: 'Ongoing',
  completed: 'Completed',
  hiatus: 'Hiatus',
};

/** Genre pills shown before the “more genres” expander. */
const GENRE_PREVIEW = 6;

/**
 * Client-side browser over an already-loaded series list.
 *
 * Search and filtering run in the browser on the slim `SeriesCardData` the
 * server passes down (see lib/series-card.ts), so this adds discovery UX with
 * no new API surface or database work. It powers the Library page, which is now
 * the single place the full catalog grid is rendered; the header search bar and
 * /library?q= deep links seed it via the `initialQuery` prop.
 *
 * The toolbar is split into labelled Status and Genre groups instead of one
 * undifferentiated chip row, and it sticks under the navbar on desktop so
 * filters stay reachable while browsing.
 */
export default function SeriesBrowser({
  series,
  emptyHint,
  initialQuery = '',
}: {
  series: SeriesCardData[];
  emptyHint?: string;
  /** Seeds the search box, e.g. from /library?q=... submitted by the header. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('updated');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showAllGenres, setShowAllGenres] = useState(false);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of series) {
      for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      // A filter that matches the entire catalog cannot narrow anything. Every
      // Atsumaru title carries "manga, aggregator", so dropping tags shared by
      // every series keeps this list focused on actual genres.
      .filter(([, count]) => count < series.length)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag);
  }, [series]);

  const previewTags = showAllGenres ? allTags : allTags.slice(0, GENRE_PREVIEW);
  // Never hide the genre the reader has selected, even when the list is collapsed.
  const genreTags =
    activeTag && !previewTags.includes(activeTag) ? [...previewTags, activeTag] : previewTags;
  const hiddenGenreCount = Math.max(allTags.length - GENRE_PREVIEW, 0);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = series.filter((item) => {
      if (status !== 'all' && item.status !== status) return false;
      if (activeTag && !item.tags.includes(activeTag)) return false;
      if (!needle) return true;
      return (
        item.title.toLowerCase().includes(needle) ||
        item.description.toLowerCase().includes(needle) ||
        item.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
        (item.author ?? '').toLowerCase().includes(needle)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'chapters') return b.chapterCount - a.chapterCount;
      // ISO timestamps sort correctly as strings and keep tied dates stable.
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [series, query, status, activeTag, sort]);

  const hasFilters = query.trim() !== '' || status !== 'all' || activeTag !== null;

  function reset() {
    setQuery('');
    setStatus('all');
    setActiveTag(null);
  }

  function toggleTag(tag: string) {
    setActiveTag((current) => (current === tag ? null : tag));
  }

  return (
    <div className="space-y-6">
      <div className="library-toolbar lg:sticky lg:top-16 lg:z-30">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16.2 16.2 4.3 4.3" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, authors, or genres…"
              aria-label="Search series"
              className="field-input h-11 !pl-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-center">
            <label htmlFor="series-sort" className="sr-only">
              Sort series
            </label>
            <select
              id="series-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="field-input h-11 w-auto cursor-pointer"
            >
              <option value="updated">Recently updated</option>
              <option value="title">Title A–Z</option>
              <option value="chapters">Most chapters</option>
            </select>

            <span aria-live="polite" className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-white">{visible.length}</span> of{' '}
              {series.length}
            </span>

            {hasFilters ? (
              <button
                type="button"
                onClick={reset}
                className="btn-ghost h-10 px-3 text-xs max-sm:col-span-2 max-sm:justify-self-start"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200/80 pt-3 dark:border-white/10 lg:flex-row lg:items-start lg:gap-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-2.5">
            <span className="filter-label">Status</span>
            <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                  aria-pressed={status === option}
                  className={`filter-pill ${status === option ? 'filter-pill-active' : ''}`}
                >
                  {STATUS_LABELS[option]}
                </button>
              ))}
            </div>
          </div>

          <span className="hidden h-7 w-px self-center bg-slate-200 dark:bg-white/10 lg:block" aria-hidden />

          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:gap-2.5">
            <span className="filter-label">Genre</span>
            <div
              role="group"
              aria-label="Filter by genre"
              className="filter-scroll flex flex-wrap gap-1.5 max-sm:-mx-1 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-1 max-sm:pb-1"
            >
              {genreTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  aria-pressed={activeTag === tag}
                  className={`filter-pill capitalize ${activeTag === tag ? 'filter-pill-active' : ''}`}
                >
                  {tag}
                </button>
              ))}
              {hiddenGenreCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAllGenres((current) => !current)}
                  aria-expanded={showAllGenres}
                  className="filter-pill border-dashed"
                >
                  {showAllGenres ? 'Show less' : 'More genres'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {visible.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((item) => (
            <SeriesCard key={item.id} series={item} />
          ))}
        </div>
      ) : (
        <div className="info-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-500">
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16.2 16.2 4.3 4.3" />
            </svg>
          </span>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {hasFilters ? 'No matches' : 'The shelf is empty'}
          </p>
          <p className="max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
            {hasFilters
              ? emptyHint ?? 'Try a different title or genre, or clear the filters to see everything.'
              : 'No series have been imported yet. Check back soon.'}
          </p>
          {hasFilters ? (
            <button type="button" onClick={reset} className="btn-ghost mt-1">
              Clear filters
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
