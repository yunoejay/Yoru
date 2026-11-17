/**
 * Live-search backend for the navbar search box.
 *
 * The library page filters its already-loaded catalog in the browser, but the
 * navbar exists on every route and carries no catalog in memory. Typing there
 * asks this module (through GET /api/search) for a handful of matches.
 *
 * Ranking is deliberately title-first: an exact title beats a prefix, a prefix
 * beats a word prefix, a general `contains` beats an author or genre match, and
 * ties fall back to the most recently updated series. Only the columns the
 * dropdown renders are selected (plus a chapter count), so a keystroke never
 * loads the chapter table the way `listSeriesViews()` does.
 */

import prisma from './prisma';
import { SERIES } from './data';
import { toClientImageSrc } from './image-proxy';
import type { SeriesSearchHit } from './types';

/** Longest query we are willing to search for. */
const MAX_QUERY_LENGTH = 80;

/** Rows considered for JS ranking; ranking then keeps the best `limit`. */
const CANDIDATE_LIMIT = 100;

export const DEFAULT_SEARCH_LIMIT = 6;
export const MAX_SEARCH_LIMIT = 10;

/** Same fail-soft logging contract as lib/content.ts: warn once, not per key. */
let warnedAboutDb = false;

/** Trim, drop empty input and cap pathological query lengths. */
export function normalizeSearchQuery(raw: string | null | undefined): string {
  return (raw ?? '').trim().slice(0, MAX_QUERY_LENGTH);
}

/** `?limit=` is optional; anything invalid falls back to the default. */
export function clampSearchLimit(raw: string | null | undefined): number {
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed)) return DEFAULT_SEARCH_LIMIT;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_SEARCH_LIMIT);
}

/**
 * Lower score = better match; null means "this row does not match".
 * `needle` must already be trimmed and lower-cased.
 */
function matchScore(
  title: string,
  author: string | null,
  tags: string[],
  needle: string,
): number | null {
  const normalizedTitle = title.toLowerCase();
  if (normalizedTitle === needle) return 0;
  if (normalizedTitle.startsWith(needle)) return 1;
  if (normalizedTitle.split(/[^a-z0-9]+/).some(word => word.startsWith(needle))) return 2;
  if (normalizedTitle.includes(needle)) return 3;
  if ((author ?? '').toLowerCase().includes(needle)) return 4;
  if (tags.some(tag => tag.toLowerCase().includes(needle))) return 5;
  return null;
}

/** Keep matching entries, order by score then the caller's tie-breaker. */
function rank<T>(
  items: T[],
  score: (item: T) => number | null,
  compare: (a: T, b: T) => number,
): T[] {
  const ranked: Array<{ item: T; score: number }> = [];
  for (const item of items) {
    const value = score(item);
    if (value !== null) ranked.push({ item, score: value });
  }
  ranked.sort((a, b) => a.score - b.score || compare(a.item, b.item));
  return ranked.map(entry => entry.item);
}

/**
 * Search imported series by title, author or (exact, lower-cased) genre tag.
 *
 * A database outage degrades to the bundled demo catalog, mirroring the
 * fail-soft rule in lib/content.ts: the navbar must never throw just because
 * Postgres is unreachable.
 */
export async function searchSeries(
  query: string,
  limit: number = DEFAULT_SEARCH_LIMIT,
): Promise<SeriesSearchHit[]> {
  const trimmed = normalizeSearchQuery(query);
  if (!trimmed) return [];
  const needle = trimmed.toLowerCase();

  try {
    const rows = await prisma.series.findMany({
      where: {
        OR: [
          { title: { contains: trimmed, mode: 'insensitive' } },
          { author: { contains: trimmed, mode: 'insensitive' } },
          // `has` is exact and case-sensitive; tags are stored lower-case, so
          // this is what makes typing "action" surface action series.
          { tags: { has: needle } },
        ],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        cover: true,
        author: true,
        tags: true,
        status: true,
        updatedAt: true,
        _count: { select: { chapters: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: CANDIDATE_LIMIT,
    });

    return rank(
      rows,
      row => matchScore(row.title, row.author, row.tags, needle),
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    )
      .slice(0, limit)
      .map(row => ({
        id: row.slug || row.id,
        title: row.title,
        cover: toClientImageSrc(row.cover),
        author: row.author,
        chapterCount: row._count.chapters,
        tags: row.tags,
        status: row.status,
        isStaticDemo: false,
      }));
  } catch (error) {
    if (!warnedAboutDb) {
      warnedAboutDb = true;
      console.warn(
        '[searchSeries] database unavailable; falling back to bundled demo data. ' +
          `Reason: ${(error as Error).message}`,
      );
    }
    return searchDemoSeries(needle, limit);
  }
}

function searchDemoSeries(needle: string, limit: number): SeriesSearchHit[] {
  return rank(
    SERIES,
    series => matchScore(series.title, null, series.tags, needle),
    (a, b) => a.title.localeCompare(b.title),
  )
    .slice(0, limit)
    .map(series => ({
      id: series.id,
      title: series.title,
      cover: toClientImageSrc(series.cover),
      author: null,
      chapterCount: series.chapters.length,
      tags: series.tags,
      status: series.status,
      isStaticDemo: true,
    }));
}
