/**
 * Content repository.
 *
 * Reads are database-first with a deliberate fallback to the bundled demo data
 * in lib/data.ts, because the content tables may not exist yet (fresh clone,
 * migration not applied, or the database simply unreachable). A reader site
 * that hard-fails into a blank page in those cases is worse than one that shows
 * demo content and logs why.
 *
 * The fallback is explicit in the returned data (`isStaticDemo`) so the UI can
 * label it rather than pretend it is real.
 */

import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { SERIES } from './data';
import { toClientImageSrc } from './image-proxy';
import type { Chapter, Series } from './types';
import type { SourceChapter } from './sources/types';

export interface ChapterView extends Chapter {
  /** null => bundled demo chapter with inline pages, not a real source. */
  sourceId: string | null;
  /** Upstream chapter UUID, resolved to pages at read time. */
  externalId: string | null;
  /** The series listing (scanlator/publisher) this row belongs to. */
  listingId: string | null;
  groupName: string | null;
  /** Upstream scanlation group id (MangaDex UUID, Atsumaru scanlation id, …). */
  groupId: string | null;
  isOfficial: boolean;
  pageCount: number;
  linkOutUrl: string | null;
  /** IS0-8601 publish date, used to settle ties deterministically. */
  publishedAt: string;
}

/**
 * Collapse raw chapter rows (one per scanlator/publisher) into a single linear
 * reading order that FOLLOWS ONE SCANLATOR until another group gets ahead.
 *
 * MangaDex stores a separate row for every group that uploads a chapter, so one
 * number (e.g. 2) can have several rows — Astra Scans' 130-page Chapter 2 and
 * Tapas' link-out Chapter 2 both exist. The old code just did
 * `chapters.findIndex(...) +/- 1`, so "Next" pointed at the duplicate and the
 * series page listed the same chapter twice.
 *
 * Rules, applied per number slot (ascending):
 *   1. READABLE rows (`pageCount > 0`) win. A number whose only rows are 0-page
 *      link-outs is kept as a single "read at publisher" entry, so the sequence
 *      never silently drops a chapter.
 *   2. The PRIMARY scanlator is the group carrying the most readable chapters
 *      (tie -> earliest first chapter). Its row is preferred for every slot it
 *      covers, even when another group published that number first (continuity
 *      beats first-published).
 *   3. When the primary group has no row for a slot, the reader switches to the
 *      group that is AHEAD from that slot onward (its run reaches the furthest
 *      number; tie -> most recent `publishedAt`) and stays with it while it
 *      keeps publishing. That is the "if the other scanlator updates faster,
 *      the latest chapters switch to that scanlator" behaviour.
 *   4. Identical group/number rows are broken deterministically, so the UI never
 *      flickers between renders.
 *
 * Returns a new, filtered array (never mutates the input).
 */
export function buildReadingOrder(chapters: ChapterView[]): ChapterView[] {
  if (!chapters.length) return [];

  const groupOf = (c: ChapterView) => c.groupName ?? '';

  // Per-scanlator stats over readable rows (used to find the primary + who's ahead).
  const stats = new Map<string, { readable: number; maxReadable: number; firstPublished: string }>();
  const rowsByNumber = new Map<number, ChapterView[]>();
  for (const chapter of chapters) {
    const list = rowsByNumber.get(chapter.number) ?? [];
    list.push(chapter);
    rowsByNumber.set(chapter.number, list);

    const group = groupOf(chapter);
    const current = stats.get(group) ?? { readable: 0, maxReadable: -Infinity, firstPublished: chapter.publishedAt };
    if (chapter.pageCount > 0) {
      current.readable += 1;
      current.maxReadable = Math.max(current.maxReadable, chapter.number);
    }
    if (chapter.publishedAt < current.firstPublished) current.firstPublished = chapter.publishedAt;
    stats.set(group, current);
  }

  // Primary scanlator: the group with the most readable chapters (tie -> the
  // earliest first chapter). The loop below still switches to whoever is ahead
  // for the slots the primary does not carry.
  let primary = groupOf(chapters[0]);
  let primaryScore = -Infinity;
  for (const [group, s] of stats) {
    const score = s.readable * 1e12 + (86400e6 - new Date(s.firstPublished).getTime());
    if (score > primaryScore) {
      primaryScore = score;
      primary = group;
    }
  }

  let currentGroup = primary;
  const numbers = Array.from(rowsByNumber.keys()).sort((a, b) => a - b);
  const ordered: ChapterView[] = [];

  for (const number of numbers) {
    const rows = rowsByNumber.get(number)!;
    const readable = rows.filter(r => r.pageCount > 0);
    const candidates = readable.length ? readable : rows;

    let chosen = candidates.find(c => groupOf(c) === currentGroup);
    if (!chosen) {
      // Pick the candidate whose group reaches furthest ahead; tie -> most recent.
      const ranked = [...candidates].sort((a, b) => {
        const da = stats.get(groupOf(a))?.maxReadable ?? -Infinity;
        const db = stats.get(groupOf(b))?.maxReadable ?? -Infinity;
        if (db !== da) return db - da;
        if (a.publishedAt !== b.publishedAt) return b.publishedAt.localeCompare(a.publishedAt);
        return groupOf(a).localeCompare(groupOf(b));
      });
      chosen = ranked[0];
      currentGroup = groupOf(chosen);
    }
    ordered.push(chosen);
  }

  return ordered;
}

/** One scanlation group that covers a series, for the reader's preference UI. */
export interface ScanlatorOption {
  /** Display + matching label; equals Chapter.groupName. */
  groupName: string;
  groupId: string | null;
  official: boolean;
  /** How many chapter rows this group has for the series (all numbers). */
  count: number;
  /** Highest chapter number this group has published, or null if none. */
  maxNumber: number | null;
}

export interface SeriesView extends Omit<Series, 'chapters'> {
  chapters: ChapterView[];
  /**
   * Every chapter number, newest first, with one row per scanlator/publisher
   * that uploaded it (the grouped cards on the series page). Optional work:
   * `chapterGroups` stays empty unless `getSeriesView` is asked for it, since the
   * home/library listings only need `chapters`.
   */
  chapterGroups: ChapterGroupView[];
  /** Scanlator labels present on this title, e.g. ["Tapas (official)"]. */
  scanlatorLabels: string[];
  /** Every scanlator covering the title, with coverage stats, for the picker. */
  scanlators: ScanlatorOption[];
  isStaticDemo: boolean;
  author?: string | null;
}

/** One chapter number and all the uploads of it, newest upload first. */
export interface ChapterGroupView {
  number: number;
  chapters: ChapterView[];
}

/**
 * Bucket raw chapter rows by number for the Atsumaru-style grouped list: one
 * card per chapter number, one row per scanlator inside it. Duplicate numbers are
 * kept here on purpose — the collapsed `chapters` reading order is what stays
 * linear; this is the "who uploaded this chapter" view.
 */
export function toChapterGroups(rows: ChapterView[]): ChapterGroupView[] {
  const byNumber = new Map<number, ChapterView[]>();
  for (const row of rows) {
    const list = byNumber.get(row.number);
    if (list) list.push(row);
    else byNumber.set(row.number, [row]);
  }

  return [...byNumber.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([number, chapters]) => ({
      number,
      chapters: chapters.sort((a, b) => {
        const published = Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
        if (Number.isFinite(published) && published !== 0) return published;
        return (a.groupName ?? '').localeCompare(b.groupName ?? '');
      }),
    }));
}


let warnedAboutDb = false;

/**
 * Runs a DB read and degrades to `fallback` when the database is not usable.
 * Auth routes must keep working, so we never let content errors bubble up.
 */
async function withDb<T>(label: string, run: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!warnedAboutDb) {
      warnedAboutDb = true;
      console.warn(
        `[content] ${label} failed; falling back to bundled demo data. Apply ` +
          `prisma/migrations/*_add_content_model and set DATABASE_URL for real content. ` +
          `Reason: ${(error as Error).message}`
      );
    }
    return fallback();
  }
}

function staticSeriesAsViews(): SeriesView[] {
  return SERIES.map(series => {
    const rawChapters: ChapterView[] = series.chapters.map(chapter => ({
      ...chapter,
      sourceId: null,
      externalId: null,
      listingId: null,
      groupName: null,
      groupId: null,
      isOfficial: false,
      pageCount: chapter.pages.length,
      linkOutUrl: null,
      publishedAt: chapter.updatedAt,
    }));
    return {
      ...series,
      cover: toClientImageSrc(series.cover),
      chapters: buildReadingOrder(rawChapters),
      chapterGroups: toChapterGroups(rawChapters),
      extraTags: series.extraTags ?? [],
      scanlatorLabels: ['Yoru demo data'],
      scanlators: [],
      isStaticDemo: true,
    };
  });
}

export type SeriesInclude = {
  listings: { include: { source: true } };
  chapters: { orderBy: ({ number: 'asc' } | { publishedAt: 'asc' })[] };
};

export type SeriesWithRelations = Prisma.SeriesGetPayload<{ include: SeriesInclude }>;

function groupLabel(chapter: { groupName: string | null; isOfficial: boolean }): string | null {
  if (!chapter.groupName) return null;
  return chapter.isOfficial ? `${chapter.groupName} (official)` : chapter.groupName;
}

export interface SeriesViewOptions {
  /**
   * Browse a single scanlator's chapters. Null/undefined keeps the collapsed
   * reading order (one row per number, following the most complete group). The
   * scanlator list on the returned view is always complete, so the UI can
   * render tabs for every group either way.
   */
  scanlator?: string | null;
  /**
   * Also build `chapterGroups` (every upload of each chapter number) for the
   * grouped series-page list. Off by default: the card rails never render it.
   */
  withChapterGroups?: boolean;
}

export function toSeriesView(
  series: SeriesWithRelations,
  options: SeriesViewOptions = {},
): SeriesView {
  const rawChapters: ChapterView[] = series.chapters.map(chapter => ({
    id: chapter.id,
    number: chapter.number,
    title: chapter.title ?? undefined,
    // Pages are never stored; the reader fetches them from the API.
    pages: [],
    updatedAt: (chapter.publishedAt ?? chapter.createdAt).toISOString(),
    sourceId: chapter.listingId ? series.listings.find(l => l.id === chapter.listingId)?.source.slug ?? null : null,
    externalId: chapter.externalId,
    listingId: chapter.listingId,
    groupName: chapter.groupName,
    groupId: chapter.groupId,
    isOfficial: chapter.isOfficial,
    pageCount: chapter.pageCount,
    linkOutUrl: chapter.externalUrl,
    publishedAt: (chapter.publishedAt ?? chapter.createdAt).toISOString(),
  }));

  // Collapse duplicate-number rows into one chapter per number, following the
  // most complete scanlator and switching to whichever group is ahead for the
  // numbers it has not published yet. This is what makes prev/next move
  // 2 -> 3 and stops the series page repeating "Chapter 2".
  //
  // `scanlator` instead browses ONE group's release: the duplicate-number rows
  // from other groups are dropped rather than collapsed, so the list is that
  // scanlation's own chapter sequence.
  const scanlatorFilter = options.scanlator?.trim();
  const filtered = scanlatorFilter
    ? rawChapters.filter(chapter => (chapter.groupName ?? '') === scanlatorFilter)
    : rawChapters;
  const chapters = buildReadingOrder(filtered.length ? filtered : rawChapters);

  // Grouped list for the series page: one card per chapter number with a row per
  // upload. Built from the same rows the reader would show, so a single-scanlator
  // tab narrows both views consistently (and a tab with no rows falls back to
  // every group, exactly like the reading order above).
  const chapterGroups = options.withChapterGroups
    ? toChapterGroups(filtered.length ? filtered : rawChapters)
    : [];

  // Enumerate every group that covers this title (from the raw rows, before the
  // collapse) so the tabs offer each one with its real coverage, even if the
  // collapsed reading order never lands on it.
  const scanlatorOptions = new Map<string, ScanlatorOption>();
  for (const chapter of rawChapters) {
    if (!chapter.groupName) continue;
    const existing = scanlatorOptions.get(chapter.groupName);
    if (existing) {
      existing.count += 1;
      if (existing.maxNumber === null || chapter.number > existing.maxNumber) {
        existing.maxNumber = chapter.number;
      }
      if (!existing.groupId && chapter.groupId) existing.groupId = chapter.groupId;
    } else {
      scanlatorOptions.set(chapter.groupName, {
        groupName: chapter.groupName,
        groupId: chapter.groupId,
        official: chapter.isOfficial,
        count: 1,
        maxNumber: chapter.number,
      });
    }
  }
  const scanlators = Array.from(scanlatorOptions.values()).sort(
    (a, b) => b.count - a.count || a.groupName.localeCompare(b.groupName),
  );

  const labels = new Set<string>();
  for (const chapter of rawChapters) {
    const label = groupLabel(chapter);
    if (label) labels.add(label);
  }

  return {
    id: series.slug || series.id,
    title: series.title,
    // Proxied so browsers never hotlink a CDN that blocks cross-site <img>
    // loads (Atsumaru's cdn.atsu.moe returns 403 on Sec-Fetch-Site).
    cover: toClientImageSrc(series.cover),
    description: series.synopsis,
    tags: series.tags,
    extraTags: series.extraTags,
    status: series.status as SeriesView['status'],
    author: series.author,
    updatedAt: series.updatedAt.toISOString(),
    chapters,
    chapterGroups,
    scanlatorLabels: Array.from(labels),
    scanlators,
    isStaticDemo: false,
  };
}

/** All series, newest content first. Falls back to demo data when unusable. */
export async function listSeriesViews(): Promise<SeriesView[]> {
  return withDb(
    'listSeriesViews',
    async () => {
      const rows = await prisma.series.findMany({
        include: {
          listings: { include: { source: true } },
          chapters: { orderBy: [{ number: 'asc' }, { publishedAt: 'asc' }] },
        } as SeriesInclude,
        orderBy: { updatedAt: 'desc' },
      });
      // An empty but reachable database should not masquerade as demo content.
      if (!rows.length) return [];
      return rows.map(row => toSeriesView(row));
    },
    staticSeriesAsViews
  );
}

export async function getSeriesView(
  idOrSlug: string,
  options: SeriesViewOptions = {},
): Promise<SeriesView | null> {
  const fallback = () => staticSeriesAsViews().find(s => s.id === idOrSlug) ?? null;

  return withDb(
    'getSeriesView',
    async () => {
      const row = await prisma.series.findFirst({
        where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
        include: {
          listings: { include: { source: true } },
          chapters: { orderBy: [{ number: 'asc' }, { publishedAt: 'asc' }] },
        } as SeriesInclude,
      });
      if (!row) {
        // The demo ids are not UUIDs, so a miss here is expected in demo mode.
        return fallback();
      }
      return toSeriesView(row, options);
    },
    fallback
  );
}

/**
 * Everything the pages route needs to resolve a chapter to images.
 * `inlinePages` is only ever populated by the bundled demo data.
 */
export interface ResolvableChapter {
  id: string;
  sourceId: string | null;
  chapter: SourceChapter | null;
  inlinePages: string[];
}

function staticLookup(chapterId: string): ResolvableChapter | null {
  for (const series of SERIES) {
    const chapter = series.chapters.find(c => c.id === chapterId);
    if (chapter) {
      return {
        id: chapterId,
        sourceId: null,
        chapter: null,
        inlinePages: chapter.pages.map(p => p.image),
      };
    }
  }
  return null;
}

export async function findResolvableChapter(chapterId: string): Promise<ResolvableChapter | null> {
  const resolved = await withDb(
    'findResolvableChapter',
    async () => {
      const row = await prisma.chapter.findUnique({
        where: { id: chapterId },
        include: { listing: { include: { source: true } } },
      });
      if (!row) return null;

      const chapter: SourceChapter = {
        externalId: row.externalId,
        number: row.number,
        volume: row.volume,
        title: row.title,
        groupName: row.groupName,
        groupId: row.groupId,
        official: row.isOfficial,
        language: row.language,
        pageCount: row.pageCount,
        publishedAt: row.publishedAt.toISOString(),
        externalUrl: row.externalUrl,
      };

      return { id: row.id, sourceId: row.listing.source.slug, chapter, inlinePages: [] };
    },
    () => null
  );

  return resolved ?? staticLookup(chapterId);
}
