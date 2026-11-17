/**
 * Pure reading-progress helpers.
 *
 * Kept separate from lib/read-progress.ts because that module imports Prisma.
 * Client components (the chapter list, the "Continue reading" button) and the
 * `check:read-progress` script import from here, so no database code can leak
 * into the browser bundle.
 */

/** One entry per story position; the series page shows one row per number. */
export interface NumberedChapter {
  number: number;
}

/**
 * The first chapter the reader has not marked read, or null when they are all
 * read (or there are none). Order is the caller's reading order, which is
 * ascending, so this is "where they are in the series".
 */
export function pickNextUnread<T extends NumberedChapter>(
  chapters: readonly T[],
  readNumbers: Iterable<number>,
): T | null {
  const read = readNumbers instanceof Set ? readNumbers : new Set(readNumbers);
  for (const chapter of chapters) {
    if (!read.has(chapter.number)) return chapter;
  }
  return null;
}

/**
 * Where "Continue reading" should land: the chapter right after the furthest
 * chapter the reader has ticked off. This treats the ticks as a position on the
 * series, so a reader who is caught up to ch. 120 continues at 121 - the
 * prologue (ch. 0) or any skipped earlier chapter does not send them back to
 * the start. With nothing ticked yet, it is the first chapter. Returns null
 * when the last chapter is already read.
 */
export function pickResumeChapter<T extends NumberedChapter>(
  chapters: readonly T[],
  readNumbers: Iterable<number>,
): T | null {
  if (!chapters.length) return null;
  const read = readNumbers instanceof Set ? readNumbers : new Set(readNumbers);

  let furthestReadIndex = -1;
  for (let index = 0; index < chapters.length; index += 1) {
    if (read.has(chapters[index].number)) furthestReadIndex = index;
  }

  if (furthestReadIndex === -1) return chapters[0];
  return chapters[furthestReadIndex + 1] ?? null;
}

/** How many of `chapters` are marked read (ignores read numbers not shown). */
export function countReadChapters(
  chapters: readonly NumberedChapter[],
  readNumbers: Iterable<number>,
): number {
  const read = readNumbers instanceof Set ? readNumbers : new Set(readNumbers);
  let count = 0;
  for (const chapter of chapters) {
    if (read.has(chapter.number)) count += 1;
  }
  return count;
}
