'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Client-side reading-progress store shared by the chapter list, the
 * "Continue reading" button and the reader footer.
 *
 * Signed-in readers are server-seeded from `ChapterRead` rows and every toggle
 * is written to `/api/series/<id>/read-progress` optimistically (rolling back on
 * failure). Signed-out readers are kept in localStorage, mirroring the
 * "saved in this browser only" treatment the anonymous scanlator preference
 * already gets. localStorage rather than a cookie because a long series has
 * 650+ chapter numbers, far past the 4 KB cookie budget, and this state is only
 * needed in the browser.
 */

const STORAGE_PREFIX = 'yoru_read_progress_v1:';

/**
 * Broadcast channel between hook instances on the same page. The hero
 * "Continue reading" button and the chapter list each own a hook instance, so
 * ticking a box in one must update the other immediately (not just after a
 * reload).
 */
const PROGRESS_EVENT = 'yoru:read-progress';

interface ProgressEventDetail {
  seriesId: string;
  numbers: number[];
}

export interface ReadProgressState {
  /** Chapter numbers marked read. */
  readNumbers: Set<number>;
  /** How many numbers are marked read (may include numbers not currently listed). */
  readCount: number;
  isRead: (number: number) => boolean;
  toggleRead: (number: number, read: boolean) => Promise<void>;
  /** True while a signed-in write is in flight. */
  pending: boolean;
  error: string | null;
}

interface Props {
  /** Public series id (slug or uuid), the same value used in /series/[id]. */
  seriesId: string;
  /** Server-seeded session state so first paint matches the session. */
  isSignedIn: boolean;
  /** Chapter numbers already read, loaded server-side for signed-in readers. */
  initialReadNumbers: number[];
}

function storageKey(seriesId: string): string {
  return `${STORAGE_PREFIX}${seriesId}`;
}

function readGuestNumbers(seriesId: string): Set<number> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(seriesId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)),
    );
  } catch {
    return new Set();
  }
}

function writeGuestNumbers(seriesId: string, numbers: Set<number>): void {
  try {
    const sorted = Array.from(numbers).sort((a, b) => a - b);
    window.localStorage.setItem(storageKey(seriesId), JSON.stringify(sorted));
  } catch {
    // Private mode or a full quota: progress just does not persist.
  }
}

/** Tell the other hook instances (hero, reader footer) about the new state. */
function broadcastProgress(seriesId: string, numbers: Set<number>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ProgressEventDetail>(PROGRESS_EVENT, {
      detail: { seriesId, numbers: Array.from(numbers) },
    }),
  );
}

export function useReadProgress({ seriesId, isSignedIn, initialReadNumbers }: Props): ReadProgressState {
  // Serialising the server list keeps the effect dependency stable across
  // renders without depending on the array's identity.
  const initialKey = initialReadNumbers.join(',');
  const [readNumbers, setReadNumbers] = useState<Set<number>>(() => new Set(initialReadNumbers));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guests hydrate from localStorage after mount, because it cannot be read
  // during SSR. Signed-in readers reconcile with the server-seeded list (for
  // example after router.refresh()).
  useEffect(() => {
    if (isSignedIn) {
      setReadNumbers(new Set(initialKey ? initialKey.split(',').map(Number) : []));
      return;
    }
    setReadNumbers(readGuestNumbers(seriesId));
  }, [seriesId, isSignedIn, initialKey]);

  // Keep this instance in step with a toggle made by another instance on the
  // same page (the hero button vs. the chapter list vs. the reader footer).
  useEffect(() => {
    function onProgress(event: Event) {
      const detail = (event as CustomEvent<ProgressEventDetail>).detail;
      if (detail?.seriesId !== seriesId || !Array.isArray(detail.numbers)) return;
      setReadNumbers(new Set(detail.numbers));
    }
    window.addEventListener(PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(PROGRESS_EVENT, onProgress);
  }, [seriesId]);

  const isRead = useCallback((number: number) => readNumbers.has(number), [readNumbers]);

  const toggleRead = useCallback(
    async (number: number, read: boolean) => {
      setError(null);
      const previous = readNumbers;
      const next = new Set(previous);
      if (read) next.add(number);
      else next.delete(number);
      setReadNumbers(next);
      broadcastProgress(seriesId, next);

      if (!isSignedIn) {
        writeGuestNumbers(seriesId, next);
        return;
      }

      setPending(true);
      try {
        const res = await fetch(`/api/series/${encodeURIComponent(seriesId)}/read-progress`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ number, read }),
        });
        if (!res.ok) {
          setReadNumbers(previous);
          broadcastProgress(seriesId, previous);
          const data = (await res.json().catch(() => ({}))) as { error?: unknown };
          setError(typeof data?.error === 'string' ? data.error : 'Could not save reading progress.');
        }
      } catch {
        setReadNumbers(previous);
        broadcastProgress(seriesId, previous);
        setError('Network error; please try again.');
      } finally {
        setPending(false);
      }
    },
    [isSignedIn, readNumbers, seriesId],
  );

  return { readNumbers, readCount: readNumbers.size, isRead, toggleRead, pending, error };
}
