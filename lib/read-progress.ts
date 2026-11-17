/**
 * Reading-progress repository.
 *
 * A reader can tick "read" on a chapter so the series page can answer "where am
 * I in this series". Progress is keyed on the chapter NUMBER, not the Chapter
 * row id: the same number can have one row per scanlator (Tower of God has a
 * Webtoon row and an Alpha row for every chapter), and where you are in the
 * story should not be lost when you switch groups. Every group's version of
 * ch. 12 therefore shares one checkbox, which is intended.
 *
 * Stores, selected by whether the reader is signed in:
 *   - Signed in: the `ChapterRead` table in Postgres, read through the helpers
 *     below that take a `userId`.
 *   - Signed out: handled in the browser (localStorage) by
 *     `components/useReadProgress.ts`. A cookie is not an option here: a long
 *     series has 650+ numbers, well past the 4 KB cookie budget, and this state
 *     is only needed client-side (unlike the scanlator preference, which feeds
 *     server-side reading order).
 *
 * Like lib/library.ts there is no demo fallback: progress belongs to a real
 * user row, so every helper degrades to an empty/negative result instead of
 * throwing into a page render.
 */

import prisma from './prisma';
import { resolveSeriesDbId } from './library';

/** Chapter numbers the user has marked read for a series, ascending. */
export async function listReadChapterNumbers(
  userId: string,
  publicSeriesId: string,
): Promise<number[]> {
  const dbId = await resolveSeriesDbId(publicSeriesId);
  if (!dbId) return [];
  try {
    const rows = await prisma.chapterRead.findMany({
      where: { userId, seriesId: dbId },
      select: { number: true },
      orderBy: { number: 'asc' },
    });
    return rows.map(row => row.number);
  } catch {
    return [];
  }
}

export type ReadMutation = { number: number; read: boolean } | { error: string };

/**
 * Mark one chapter number read/unread. Idempotent: re-marking keeps the
 * original `readAt`, and un-marking an already-unread number is a no-op.
 */
export async function setChapterRead(
  userId: string,
  publicSeriesId: string,
  number: number,
  read: boolean,
): Promise<ReadMutation> {
  if (!Number.isFinite(number) || number < 0) {
    return { error: 'A valid chapter number is required.' };
  }

  const dbId = await resolveSeriesDbId(publicSeriesId);
  if (!dbId) return { error: 'Series not found.' };

  try {
    if (read) {
      await prisma.chapterRead.upsert({
        where: { userId_seriesId_number: { userId, seriesId: dbId, number } },
        create: { userId, seriesId: dbId, number },
        update: {},
      });
    } else {
      await prisma.chapterRead.deleteMany({ where: { userId, seriesId: dbId, number } });
    }
    return { number, read };
  } catch {
    return { error: 'Could not update reading progress.' };
  }
}
