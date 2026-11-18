'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import LibraryButton from './LibraryButton';
import SeriesCard from './SeriesCard';
import {
  LIBRARY_STATUSES,
  LIBRARY_STATUS_DOT,
  LIBRARY_STATUS_LABELS,
  type LibraryStatus,
} from '@/lib/library-status';
import {
  filterAndSortLibraryItems,
  type LibraryShelfFilter,
  type LibraryShelfItem,
  type LibraryShelfSort,
} from '@/lib/library-browser-core';

/** One row of the personal bookmarks, projected for the client. */
export type MyLibraryItem = LibraryShelfItem;

type Filter = LibraryShelfFilter;

/**
 * Sort options for a large shelf. `updated` means "last status change", which
 * is the order `listLibraryEntries` (and therefore `items`) arrives in; the
 * date-added options use the `LibraryEntry.createdAt` timestamp passed down as
 * `addedAt`.
 */
const SORT_OPTIONS: ReadonlyArray<{ value: LibraryShelfSort; label: string }> = [
  { value: 'updated', label: 'Recently changed' },
  { value: 'added_desc', label: 'Recently added' },
  { value: 'added_asc', label: 'Oldest added' },
  { value: 'title', label: 'Title A–Z' },
];

/**
 * Status filter, search and sort over the already-loaded bookmarks.
 *
 * Filtering is client-side over the already-loaded list (same pattern as
 * SeriesBrowser): the server hands down the full shelf once, so searching or
 * switching statuses costs nothing. Each card keeps its own LibraryButton, which
 * is what lets a reader re-file or remove a series without leaving the page.
 *
 * The search box matches title, author, genre/tag, synopsis and scanlator, so a
 * reader with hundreds of bookmarks can jump to a title without scrolling the
 * whole grid. Sorting by date added is the other half of that: "Recently added"
 * answers "what did I file last?", "Oldest added" surfaces the backlog.
 */
export default function MyLibraryBrowser({ items }: { items: MyLibraryItem[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<LibraryShelfSort>('updated');

  const counts = useMemo(() => {
    const map = new Map<LibraryStatus, number>();
    for (const item of items) map.set(item.status, (map.get(item.status) ?? 0) + 1);
    return map;
  }, [items]);

  const visible = useMemo(
    () => filterAndSortLibraryItems(items, { query, filter, sort }),
    [items, filter, query, sort],
  );

  const hasFilters = query.trim() !== '' || filter !== 'all';

  function reset() {
    setQuery('');
    setFilter('all');
  }

  if (!items.length) {
    return (
      <div className="info-card flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="text-4xl" aria-hidden>
          📚
        </span>
        <p className="text-lg font-semibold text-slate-900 dark:text-white">Your bookmarks are empty</p>
        <p className="max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
          Open any series and pick a reading status — Reading, Plan to read, Completed — and it
          will show up here.
        </p>
        <Link href="/library" className="btn-primary mt-1">
          Browse the catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="library-toolbar space-y-4 lg:sticky lg:top-16 lg:z-30">
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
              onChange={event => setQuery(event.target.value)}
              placeholder="Search your bookmarks by title, author, or genre…"
              aria-label="Search bookmarks"
              className="field-input h-11 !pl-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-center">
            <label htmlFor="bookmark-sort" className="sr-only">
              Sort bookmarks
            </label>
            <select
              id="bookmark-sort"
              value={sort}
              onChange={event => setSort(event.target.value as LibraryShelfSort)}
              className="field-input h-11 w-auto cursor-pointer"
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <span aria-live="polite" className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-white">{visible.length}</span>{' '}
              of {items.length}
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

        <div className="flex flex-col gap-2 border-t border-slate-200/80 pt-3 dark:border-white/10 sm:flex-row sm:items-start sm:gap-3">
          <span className="filter-label">Status</span>
          <div
            role="group"
            aria-label="Filter by reading status"
            className="filter-scroll flex gap-1.5 overflow-x-auto pb-1"
          >
            <button
              type="button"
              onClick={() => setFilter('all')}
              aria-pressed={filter === 'all'}
              className={`filter-pill ${filter === 'all' ? 'filter-pill-active' : ''}`}
            >
              All <span className="ml-1 opacity-70">{items.length}</span>
            </button>
            {LIBRARY_STATUSES.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                aria-pressed={filter === option}
                className={`filter-pill ${filter === option ? 'filter-pill-active' : ''}`}
              >
                <span
                  className={`mr-1.5 h-1.5 w-1.5 rounded-full ${LIBRARY_STATUS_DOT[option]}`}
                  aria-hidden
                />
                {LIBRARY_STATUS_LABELS[option]}
                <span className="ml-1 opacity-70">{counts.get(option) ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {visible.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map(item => (
            <div key={item.series.id} className="flex min-w-0 flex-col gap-2">
              <SeriesCard series={item.series} />
              <LibraryButton
                seriesId={item.series.id}
                isSignedIn
                initialStatus={item.status}
                compact
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="info-card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            {hasFilters ? 'No bookmarks match' : 'Your bookmarks are empty'}
          </p>
          <p className="max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
            {hasFilters
              ? 'Try a different title, author or genre — or clear the search and status filter to see your whole shelf.'
              : 'Use the status menu under any cover to move a series into this list.'}
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
