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
import type { SeriesCardData } from '@/lib/series-card';

/** One row of the personal bookmarks, projected for the client. */
export interface MyLibraryItem {
  status: LibraryStatus;
  /** ISO timestamp of when the series was added. */
  addedAt: string;
  series: SeriesCardData;
}

type Filter = 'all' | LibraryStatus;

/**
 * Status filter + card grid for /my-library.
 *
 * Filtering is client-side over the already-loaded list (same pattern as
 * SeriesBrowser): the server hands down the full shelf once, so switching
 * statuses costs nothing. Each card keeps its own LibraryButton, which is what
 * lets a reader re-file or remove a series without leaving the page.
 */
export default function MyLibraryBrowser({ items }: { items: MyLibraryItem[] }) {
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const map = new Map<LibraryStatus, number>();
    for (const item of items) map.set(item.status, (map.get(item.status) ?? 0) + 1);
    return map;
  }, [items]);

  const visible = filter === 'all' ? items : items.filter(item => item.status === filter);

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
      <div className="library-toolbar">
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
            Nothing marked {filter === 'all' ? 'yet' : `“${LIBRARY_STATUS_LABELS[filter]}” yet`}
          </p>
          <p className="max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
            Use the status menu under any cover to move a series into this list.
          </p>
          <button type="button" onClick={() => setFilter('all')} className="btn-ghost mt-1">
            Show all
          </button>
        </div>
      )}
    </div>
  );
}
