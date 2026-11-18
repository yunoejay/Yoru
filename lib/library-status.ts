/**
 * Reading statuses for the personal library.
 *
 * Deliberately free of Prisma imports so client components (the status menu on
 * series pages, the /my-library filter pills) can import labels without pulling
 * the database layer into the browser bundle. Persistence lives in
 * lib/library.ts; validation happens in /api/library.
 */

export const LIBRARY_STATUSES = [
  'reading',
  'rereading',
  'plan_to_read',
  'completed',
  'on_hold',
  'dropped',
] as const;

export type LibraryStatus = (typeof LIBRARY_STATUSES)[number];

/** Status applied when a series is added without picking one explicitly. */
export const DEFAULT_LIBRARY_STATUS: LibraryStatus = 'plan_to_read';

export const LIBRARY_STATUS_LABELS: Record<LibraryStatus, string> = {
  reading: 'Reading',
  rereading: 'Rereading',
  plan_to_read: 'Plan to read',
  completed: 'Completed',
  on_hold: 'On hold',
  dropped: 'Dropped',
};

/** Dot colours for the status menu, pills and cards (Tailwind utility names). */
export const LIBRARY_STATUS_DOT: Record<LibraryStatus, string> = {
  reading: 'bg-emerald-400',
  rereading: 'bg-violet-400',
  plan_to_read: 'bg-slate-400',
  completed: 'bg-sky-400',
  on_hold: 'bg-amber-400',
  dropped: 'bg-rose-400',
};

export function isLibraryStatus(value: unknown): value is LibraryStatus {
  return typeof value === 'string' && (LIBRARY_STATUSES as readonly string[]).includes(value);
}

/**
 * Statuses are stored as free-form TEXT. Anything unrecognised (a row from a
 * future version, or one edited by hand) reads as the default instead of
 * breaking the page.
 */
export function normalizeLibraryStatus(value: string): LibraryStatus {
  return isLibraryStatus(value) ? value : DEFAULT_LIBRARY_STATUS;
}

export function libraryStatusLabel(value: string): string {
  return LIBRARY_STATUS_LABELS[normalizeLibraryStatus(value)];
}

/**
 * The status a series should carry after the reader opens one of its chapters.
 *
 * Opening any chapter - chapter 1, a random chapter, a re-read - proves the
 * reader is reading that series, so a passive or finished status (`plan_to_read`,
 * `on_hold`, `dropped`, `completed`) moves to `reading`, and a series that was
 * never filed is added as `reading`. That is what shelves a title the reader
 * already read elsewhere the moment they open a chapter here, and what keeps
 * "currently reading" honest when they return to a caught-up series.
 *
 * The two active-reading statuses are kept as they are: `reading` is already
 * right, and `rereading` is a deliberate, more specific choice that should
 * survive opening a chapter. Returns null when no write is needed.
 */
export function statusAfterOpeningChapter(current: LibraryStatus | null): LibraryStatus | null {
  if (current === 'reading' || current === 'rereading') return null;
  return 'reading';
}
