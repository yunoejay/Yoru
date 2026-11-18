/**
 * Pure search/filter/sort rules for the personal bookmarks shelf.
 *
 * Kept free of React and Prisma (like lib/read-progress-core.ts) so the
 * /my-library client component stays thin and the behaviour can be checked
 * without a browser. The server hands the whole shelf down once; everything
 * here runs in the browser, so searching or re-sorting costs no request.
 */

import type { LibraryStatus } from './library-status';
import type { SeriesCardData } from './series-card';

/** One bookmarked series as the client receives it. */
export interface LibraryShelfItem {
  status: LibraryStatus;
  /** `LibraryEntry.createdAt`, ISO formatted. */
  addedAt: string;
  series: SeriesCardData;
}

/** `all` plus every reading status. */
export type LibraryShelfFilter = 'all' | LibraryStatus;

/**
 * `updated` = last status change (the order `listLibraryEntries` returns);
 * the two `added` keys sort by when the series was filed.
 */
export type LibraryShelfSort = 'updated' | 'added_desc' | 'added_asc' | 'title';

export interface LibraryShelfOptions {
  query?: string;
  filter?: LibraryShelfFilter;
  sort?: LibraryShelfSort;
}

/** Does the series match a typed search (title, author, synopsis, tag, group)? */
export function matchesLibraryQuery(item: LibraryShelfItem, needle: string): boolean {
  const { series } = item;
  return (
    series.title.toLowerCase().includes(needle) ||
    (series.author ?? '').toLowerCase().includes(needle) ||
    series.description.toLowerCase().includes(needle) ||
    series.tags.some(tag => tag.toLowerCase().includes(needle)) ||
    series.scanlatorLabels.some(label => label.toLowerCase().includes(needle))
  );
}

/**
 * The bookmarks the grid should render, in the requested order.
 *
 * `items` is expected most-recently-changed first, which is what the repository
 * returns; `updated` therefore leaves the order untouched instead of re-sorting
 * on a timestamp the client does not carry. Ties fall back to the title so the
 * grid never reshuffles between renders.
 */
export function filterAndSortLibraryItems<T extends LibraryShelfItem>(
  items: readonly T[],
  { query = '', filter = 'all', sort = 'updated' }: LibraryShelfOptions = {},
): T[] {
  const needle = query.trim().toLowerCase();
  const filtered = items.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false;
    if (!needle) return true;
    return matchesLibraryQuery(item, needle);
  });

  if (sort === 'updated') return filtered;

  return [...filtered].sort((a, b) => {
    if (sort === 'title') {
      return a.series.title.localeCompare(b.series.title) || a.series.id.localeCompare(b.series.id);
    }
    if (sort === 'added_asc') {
      return a.addedAt.localeCompare(b.addedAt) || a.series.title.localeCompare(b.series.title);
    }
    return b.addedAt.localeCompare(a.addedAt) || a.series.title.localeCompare(b.series.title);
  });
}
