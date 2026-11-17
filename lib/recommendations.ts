/**
 * Home-page category ranking.
 *
 * The schema carries no explicit popularity / trending signal, so every ranking
 * here is a deterministic heuristic derived from data we already have: how
 * recently a series published a chapter, how many chapters it has, and how many
 * scanlators cover it. These are intentionally pure functions over an already
 * loaded `SeriesView[]` so the home page fetches the catalog once and never
 * touches the database per category.
 *
 * Recency uses the newest chapter publish date (falling back to the series
 * updatedAt), NOT the row's `updatedAt`, because importing/syncing a series
 * bumps `updatedAt` without meaning "new content".
 */

import type { SeriesView } from './content';
import type { LibraryStatus } from './library-status';
import { toSeriesCardData, type SeriesCardData } from './series-card';

const DAY_MS = 24 * 60 * 60 * 1000;

function toTime(value: string): number {
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

/** Newest chapter publish date, or the series updatedAt when there are none. */
function lastActivityAt(series: SeriesView): number {
  let latest = toTime(series.updatedAt);
  for (const chapter of series.chapters) {
    const t = toTime(chapter.publishedAt) || toTime(chapter.updatedAt);
    if (t > latest) latest = t;
  }
  return latest;
}

function chapterCount(series: SeriesView): number {
  return series.chapters.length;
}

function toCards(series: SeriesView[]): SeriesCardData[] {
  return series.map(toSeriesCardData);
}

/** Most-recently-active titles first (the "Latest / Recently Updated" rails). */
export function pickLatestUpdates(views: SeriesView[], limit: number): SeriesCardData[] {
  return toCards(
    [...views].sort((a, b) => lastActivityAt(b) - lastActivityAt(a) || a.title.localeCompare(b.title)),
  ).slice(0, limit);
}

/** Deepest catalogs first — a stand-in for "popular" until we track reads. */
export function pickPopular(views: SeriesView[], limit: number): SeriesCardData[] {
  return toCards(
    [...views].sort(
      (a, b) =>
        chapterCount(b) - chapterCount(a) ||
        lastActivityAt(b) - lastActivityAt(a) ||
        a.title.localeCompare(b.title),
    ),
  ).slice(0, limit);
}

/**
 * Trending = recent activity weighted by catalog depth + scanlator coverage.
 * A weekly half-life keeps a title "trending" for days after it updates, then
 * it falls off as depth alone becomes insufficient to hold rank.
 */
export function pickTrending(views: SeriesView[], limit: number): SeriesCardData[] {
  const now = Date.now();
  const score = (s: SeriesView) => {
    const days = Math.max(0, (now - lastActivityAt(s)) / DAY_MS);
    const recency = 1 / (1 + days / 7);
    const depth = Math.log2(chapterCount(s) + 1);
    const coverage = s.scanlatorLabels.length;
    return depth * (1 + recency * 2) + coverage * 0.25;
  };
  return toCards([...views].sort((a, b) => score(b) - score(a) || a.title.localeCompare(b.title))).slice(
    0,
    limit,
  );
}

/**
 * Hot updates = titles with the most chapters published in the trailing window,
 * regardless of catalog size. Returns [] when nothing updated inside `windowDays`
 * so the caller can hide or fall back.
 */
export function pickHotUpdates(
  views: SeriesView[],
  limit: number,
  windowDays = 30,
): SeriesCardData[] {
  const since = Date.now() - windowDays * DAY_MS;
  const recentChapters = (s: SeriesView) =>
    s.chapters.filter((c) => (toTime(c.publishedAt) || toTime(c.updatedAt)) >= since).length;

  return toCards(
    [...views]
      .filter((s) => recentChapters(s) > 0)
      .sort(
        (a, b) =>
          recentChapters(b) - recentChapters(a) ||
          lastActivityAt(b) - lastActivityAt(a) ||
          a.title.localeCompare(b.title),
      ),
  ).slice(0, limit);
}

/**
 * The slice of a library entry this module needs for the personal rail.
 *
 * Structural on purpose: the caller passes `LibraryEntryView[]` from
 * lib/library.ts, but this module stays free of the Prisma import that lives
 * there (only the status type is shared).
 */
export interface UpdatesForYouEntry {
  status: LibraryStatus;
  series: SeriesView;
}

/**
 * "Updates for you" — of the series in the reader's bookmarks, those with the
 * freshest activity. A subset of the bookmark list, so it reads as a
 * personalised version of "Recently Updated".
 *
 * Completed titles are left out, in both senses the app knows:
 *   - `entry.status === 'completed'` — the reader filed the series as finished,
 *     so there is nothing left to catch up on.
 *   - `series.status === 'completed'` — the series itself is published as
 *     finished, so whatever a scanlator uploads later is backfill, not news.
 */
export function pickUpdatesForYou(
  entries: UpdatesForYouEntry[],
  limit: number,
): SeriesCardData[] {
  const updatable = entries.filter(
    (entry) => entry.status !== 'completed' && entry.series.status !== 'completed',
  );
  return pickLatestUpdates(
    updatable.map((entry) => entry.series),
    limit,
  );
}
