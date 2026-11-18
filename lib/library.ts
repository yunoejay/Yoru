/**
 * Personal bookmark repository.
 *
 * Backs /my-library, the status picker on series pages, the account
 * "bookmarks" counter and the home "Updates for you" / "Bookmarks" rails. This
 * replaces the old bookmark flag: an entry is the same user<->series
 * relation, now carrying a reading status.
 *
 * Unlike the content reads in lib/content.ts there is no bundled-demo fallback
 * here: auth (and therefore personal bookmarks) already requires the database,
 * so every helper degrades to an empty/negative result when the DB is
 * unreachable instead of throwing into the page render.
 *
 * The UI addresses series by their public id (`slug || uuid`, see toSeriesView)
 * while the foreign key is the DB uuid, so writes resolve the public id first.
 */

import prisma from './prisma';
import { toSeriesView, type SeriesView } from './content';
import {
  normalizeLibraryStatus,
  statusAfterOpeningChapter,
  type LibraryStatus,
} from './library-status';

/** A library row joined with its full series view, ready for the UI. */
export interface LibraryEntryView {
  status: LibraryStatus;
  /** ISO timestamp of when the series was added. */
  addedAt: string;
  /** ISO timestamp of the last status change (what /my-library sorts by). */
  updatedAt: string;
  series: SeriesView;
}

/** Resolve a public series id (slug or uuid) to its DB uuid, or null. */
export async function resolveSeriesDbId(publicId: string): Promise<string | null> {
  try {
    const row = await prisma.series.findFirst({
      where: { OR: [{ id: publicId }, { slug: publicId }] },
      select: { id: true },
    });
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/** The user's library, most recently updated first. */
export async function listLibraryEntries(userId: string): Promise<LibraryEntryView[]> {
  try {
    const rows = await prisma.libraryEntry.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        series: {
          include: {
            listings: { include: { source: true } },
            chapters: { orderBy: [{ number: 'asc' }, { publishedAt: 'asc' }] },
          },
        },
      },
    });
    return rows.map((row) => ({
      status: normalizeLibraryStatus(row.status),
      addedAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      series: toSeriesView(row.series as never),
    }));
  } catch {
    return [];
  }
}

/** The user's status for a series, or null when it is not in their library. */
export async function getLibraryEntry(
  userId: string,
  publicSeriesId: string,
): Promise<{ status: LibraryStatus } | null> {
  const dbId = await resolveSeriesDbId(publicSeriesId);
  if (!dbId) return null;
  try {
    const row = await prisma.libraryEntry.findUnique({
      where: { userId_seriesId: { userId, seriesId: dbId } },
      select: { status: true },
    });
    return row ? { status: normalizeLibraryStatus(row.status) } : null;
  } catch {
    return null;
  }
}

/**
 * Add the series to the library or move it to another status. Upsert keeps the
 * endpoint idempotent, so two tabs changing the same series cannot create
 * duplicate rows.
 */
export async function setLibraryStatus(
  userId: string,
  publicSeriesId: string,
  status: LibraryStatus,
): Promise<{ status: LibraryStatus } | { error: string }> {
  const dbId = await resolveSeriesDbId(publicSeriesId);
  if (!dbId) return { error: 'Series not found.' };

  try {
    await prisma.libraryEntry.upsert({
      where: { userId_seriesId: { userId, seriesId: dbId } },
      create: { userId, seriesId: dbId, status },
      update: { status },
    });
    return { status };
  } catch {
    return { error: 'Could not update your bookmarks.' };
  }
}

/**
 * File the series as `reading` because the reader opened one of its chapters.
 *
 * This is the automatic counterpart to the status picker: any chapter open -
 * chapter 1 after importing progress from another site, a random chapter, a
 * re-read - shelves the title as "Reading" so the bookmarks rails and
 * /my-library reflect what is actually being read. `statusAfterOpeningChapter`
 * owns the transition rules; an entry already in `reading`/`rereading` is left
 * untouched, so repeated chapter opens cost one SELECT and never bump
 * `updatedAt` (which would re-sort /my-library).
 *
 * Returns the resulting status, or an error when the series is unknown/the DB
 * is down. The reader treats the call as a background side effect.
 */
export async function markSeriesReading(
  userId: string,
  publicSeriesId: string,
): Promise<{ status: LibraryStatus } | { error: string }> {
  const dbId = await resolveSeriesDbId(publicSeriesId);
  if (!dbId) return { error: 'Series not found.' };

  try {
    const existing = await prisma.libraryEntry.findUnique({
      where: { userId_seriesId: { userId, seriesId: dbId } },
      select: { status: true },
    });

    if (existing) {
      const current = normalizeLibraryStatus(existing.status);
      const next = statusAfterOpeningChapter(current);
      if (!next) return { status: current };
    }

    await prisma.libraryEntry.upsert({
      where: { userId_seriesId: { userId, seriesId: dbId } },
      create: { userId, seriesId: dbId, status: 'reading' },
      update: { status: 'reading' },
    });
    return { status: 'reading' };
  } catch {
    return { error: 'Could not update your reading status.' };
  }
}

/** Remove a series from the library (no-op if it was never there). */
export async function removeLibraryEntry(
  userId: string,
  publicSeriesId: string,
): Promise<{ removed: true } | { error: string }> {
  const dbId = await resolveSeriesDbId(publicSeriesId);
  if (!dbId) return { error: 'Series not found.' };

  try {
    await prisma.libraryEntry.deleteMany({ where: { userId, seriesId: dbId } });
    return { removed: true };
  } catch {
    return { error: 'Could not remove that series from your bookmarks.' };
  }
}

/** How many series the user has filed, for the account page stat. */
export async function countLibraryEntries(userId: string): Promise<number> {
  try {
    return await prisma.libraryEntry.count({ where: { userId } });
  } catch {
    return 0;
  }
}
