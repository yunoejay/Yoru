/**
 * Client helper for the "opening a chapter means reading" rule.
 *
 * The reader and the chapter list call this when a reader opens a chapter (or
 * a chapter that links out to the publisher). It is deliberately
 * fire-and-forget: shelf bookkeeping must never block or slow the chapter, and
 * a failure is harmless because the next chapter open tries again.
 *
 * The heavy lifting is server-side in `markSeriesReading` (lib/library.ts),
 * which leaves an existing `reading`/`rereading` status alone. Guests get a
 * 401 here; callers only invoke it when signed in.
 */
export function markSeriesReading(seriesId: string): void {
  if (!seriesId) return;
  void fetch(`/api/series/${encodeURIComponent(seriesId)}/reading`, {
    method: 'POST',
    credentials: 'same-origin',
    // Let the request finish even if the reader immediately opens another chapter.
    keepalive: true,
  }).catch(() => undefined);
}
