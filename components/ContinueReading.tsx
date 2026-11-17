'use client';

import Link from 'next/link';
import { countReadChapters, pickResumeChapter } from '@/lib/read-progress-core';
import { useReadProgress } from './useReadProgress';

interface Props {
  /** Public series id (slug or uuid), used for the reader link and progress writes. */
  seriesId: string;
  /** The reading order, so "continue" lands on the next unread chapter. */
  chapters: Array<{ id: string; number: number }>;
  isSignedIn: boolean;
  initialReadNumbers: number[];
}

/**
 * Hero call-to-action that answers "where am I?" directly: it opens the chapter
 * after the furthest one marked read and shows how many chapters are done.
 *
 * Signed-in readers get their progress server-side. Guests hydrate from
 * localStorage just after mount, so the first paint shows "Start reading"
 * and settles on the real position a moment later.
 */
export default function ContinueReading({
  seriesId,
  chapters,
  isSignedIn,
  initialReadNumbers,
}: Props) {
  const { readNumbers } = useReadProgress({ seriesId, isSignedIn, initialReadNumbers });

  if (!chapters.length) return null;

  const next = pickResumeChapter(chapters, readNumbers);
  const readCount = countReadChapters(chapters, readNumbers);
  const target = next ?? chapters[0];

  const label = !next
    ? `All caught up — reread Ch. ${target.number}`
    : readCount === 0
      ? `Start reading Ch. ${target.number}`
      : `Continue Ch. ${target.number}`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href={`/reader/${seriesId}/${target.id}`} className="btn-primary">
        {label}
      </Link>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {readCount} of {chapters.length} chapters read
      </span>
    </div>
  );
}
