'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { countReadChapters } from '@/lib/read-progress-core';
import { useReadProgress } from './useReadProgress';

/** One upload of a chapter — a scanlator/publisher row inside a group. */
export interface ChapterRow {
  id: string;
  groupName: string | null;
  isOfficial: boolean;
  pageCount: number;
  linkOutUrl: string | null;
  /** Pre-formatted relative date ("2 months ago") so SSR and hydration agree. */
  updatedLabel: string;
}

/** One chapter number with every upload of it, newest upload first. */
export interface ChapterGroupRow {
  number: number;
  /** Optional title shared by the uploads ("Chapter 12: " noise already stripped). */
  title: string | null;
  rows: ChapterRow[];
}

interface Props {
  /** Public series id (slug or uuid), used for reader links and progress writes. */
  seriesId: string;
  /** Chapter numbers, newest first, each carrying its per-scanlator rows. */
  groups: ChapterGroupRow[];
  isSignedIn: boolean;
  initialReadNumbers: number[];
  /** The scanlator being browsed, or null for the collapsed reading order. */
  activeScanlator: string | null;
}

/** Newest chapter numbers at the top, and the same number of oldest ones at the bottom. */
const COLLAPSED_COUNT = 10;

/**
 * The series page chapter list, modelled on the source site: one card per
 * chapter number ("CH. 10") holding a row for every scanlator that uploaded it,
 * newest chapter number first.
 *
 * Long-running titles (Tower of God: 652 numbers) would otherwise open as a wall
 * of rows, so the collapsed view shows two blocks: the newest COLLAPSED_COUNT
 * chapter numbers at the top and the oldest COLLAPSED_COUNT at the bottom, with a
 * "Show all chapters" bar between them. That keeps the latest release on screen
 * and chapter 1 within reach; the bar fills in the middle, and "Show latest 10
 * only" puts the two blocks back.
 *
 * Read state is keyed on the chapter NUMBER, so every scanlator row of a chapter
 * mirrors the same tick and progress survives switching groups.
 */
export default function ChapterList({
  seriesId,
  groups,
  isSignedIn,
  initialReadNumbers,
  activeScanlator,
}: Props) {
  const { readNumbers, isRead, toggleRead, pending, error } = useReadProgress({
    seriesId,
    isSignedIn,
    initialReadNumbers,
  });

  const [expanded, setExpanded] = useState(false);
  /**
   * Only split the list when there is a middle worth hiding. With 20 or fewer
   * chapter numbers the newest block and the oldest block would overlap, so the
   * whole list renders without a toggle.
   */
  const canCollapse = groups.length > COLLAPSED_COUNT * 2;
  const newestGroups = useMemo(() => groups.slice(0, COLLAPSED_COUNT), [groups]);
  const oldestGroups = useMemo(() => groups.slice(-COLLAPSED_COUNT), [groups]);

  const chapterNumbers = useMemo(
    () => groups.map((group) => ({ number: group.number })),
    [groups],
  );
  const readCount = useMemo(
    () => countReadChapters(chapterNumbers, readNumbers),
    [chapterNumbers, readNumbers],
  );
  const percent = groups.length ? Math.round((readCount / groups.length) * 100) : 0;
  const hiddenCount = Math.max(0, groups.length - COLLAPSED_COUNT * 2);

  /**
   * "Show all chapters": fill the gap between the newest block and the oldest
   * block, and scroll to the first revealed card so the reader does not lose
   * their place at the button.
   */
  function revealAll() {
    setExpanded(true);
    window.setTimeout(() => scrollToChapter(groups[COLLAPSED_COUNT].number), 0);
  }

  /** Back to the two-block view, with the chapter list still in sight. */
  function collapse() {
    setExpanded(false);
    window.setTimeout(() => scrollToChapter(groups[0].number), 0);
  }

  function scrollToChapter(number: number) {
    document
      .getElementById(`chapter-${number}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Chapter 1 is the last card (the list runs newest-first) and starts
   * collapsed. Reveal every card, then scroll to the anchor once committed.
   */
  function jumpToFirstChapter() {
    const firstChapter = groups[groups.length - 1];
    setExpanded(true);
    window.setTimeout(() => {
      document
        .getElementById(`chapter-${firstChapter.number}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  if (!groups.length) {
    return (
      <div className="info-card py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        No chapters are available for this title yet.
      </div>
    );
  }

  const firstChapter = groups[groups.length - 1];
  const heading = activeScanlator ? `Chapters — ${activeScanlator}` : 'Chapters';

  /** Same card markup for the newest block, the oldest block and the full list. */
  const renderGroups = (list: ChapterGroupRow[]) =>
    list.map(group => (
      <ChapterGroupCard
        key={group.number}
        seriesId={seriesId}
        group={group}
        read={isRead(group.number)}
        readPending={pending}
        onToggleRead={toggleRead}
      />
    ));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{heading}</h2>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            {groups.length} chapters · {readCount} read · newest first
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={jumpToFirstChapter}
            className="btn-ghost !px-3 !py-1.5 text-xs"
            title={`Show every chapter and jump to chapter ${firstChapter.number}`}
          >
            Jump to ch. {firstChapter.number}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
        <span className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-gray-800" aria-hidden>
          <span
            className="block h-full bg-gradient-to-r from-brand to-brand-accent transition-[width] duration-150"
            style={{ width: `${percent}%` }}
          />
        </span>
        <span>{percent}% complete</span>
      </div>

      {!isSignedIn ? (
        <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
          Ticks are saved in this browser.{' '}
          <Link href="/login" className="font-medium text-brand underline dark:text-brand-accent">
            Log in
          </Link>{' '}
          to sync your progress across devices.
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-500 dark:text-red-300">{error}</p> : null}

      {expanded || !canCollapse ? (
        <div className="space-y-3">{renderGroups(groups)}</div>
      ) : (
        <>
          {/* Newest chapters first — the latest release is always on screen. */}
          <div className="space-y-3">{renderGroups(newestGroups)}</div>

          {/*
            The oldest chapters stay at the bottom, so chapter 1 is one click (or
            one flick of the scrollbar) away. Everything in between waits behind
            this bar, keeping a 652-chapter series from opening as a wall of rows.
          */}
          <button
            type="button"
            onClick={revealAll}
            className="chapter-show-all"
            title={`Reveal the ${hiddenCount} chapter numbers in between`}
          >
            Show all chapters
          </button>

          <div className="space-y-3">{renderGroups(oldestGroups)}</div>
        </>
      )}

      {expanded && canCollapse ? (
        <button
          type="button"
          onClick={collapse}
          className="chapter-show-all"
          title={`Hide the middle again and keep the newest ${COLLAPSED_COUNT} plus chapter 1`}
        >
          Show latest {COLLAPSED_COUNT} only
        </button>
      ) : null}
    </div>
  );
}

/**
 * One chapter number: a "CH. N" header and a row per scanlator upload.
 */
function ChapterGroupCard({
  seriesId,
  group,
  read,
  readPending,
  onToggleRead,
}: {
  seriesId: string;
  group: ChapterGroupRow;
  read: boolean;
  readPending: boolean;
  onToggleRead: (number: number, read: boolean) => Promise<void>;
}) {
  return (
    <div id={`chapter-${group.number}`} className="chapter-group scroll-mt-24">
      <p className="chapter-group-title">
        CH. {group.number}
        {group.title ? <span className="chapter-group-subtitle"> · {group.title}</span> : null}
      </p>
      <ul>
        {group.rows.map((row) => (
          <li key={row.id}>
            <ChapterListRow
              seriesId={seriesId}
              number={group.number}
              row={row}
              read={read}
              readPending={readPending}
              onToggleRead={onToggleRead}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One upload row inside a chapter card: "Chapter 218 | Alpha", the relative
 * upload date, and the read checkbox shared by every upload of that number.
 */
function ChapterListRow({
  seriesId,
  number,
  row,
  read,
  readPending,
  onToggleRead,
}: {
  seriesId: string;
  number: number;
  row: ChapterRow;
  read: boolean;
  readPending: boolean;
  onToggleRead: (number: number, read: boolean) => Promise<void>;
}) {
  const isLinkOut = Boolean(row.linkOutUrl) && !row.pageCount;

  const label = (
    <>
      <span
        className={`font-medium ${read ? 'text-slate-400 line-through dark:text-slate-500' : ''}`}
      >
        Chapter {number}
      </span>
      {row.groupName ? (
        <>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className="text-slate-500 dark:text-slate-400">
            {row.groupName}
            {row.isOfficial ? ' (official)' : ''}
          </span>
        </>
      ) : null}
      {isLinkOut ? <span className="chip ml-1">Read at publisher ↗</span> : null}
    </>
  );

  return (
    <div className="chapter-row">
      {isLinkOut ? (
        <a
          href={row.linkOutUrl ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="chapter-row-link"
        >
          {label}
        </a>
      ) : (
        <Link href={`/reader/${seriesId}/${row.id}`} className="chapter-row-link">
          {label}
        </Link>
      )}

      <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
        {row.updatedLabel}
      </span>

      <label
        className="flex shrink-0 cursor-pointer items-center"
        title={read ? `Mark chapter ${number} as unread` : `Mark chapter ${number} as read`}
      >
        <input
          type="checkbox"
          className="h-4 w-4 cursor-pointer accent-brand disabled:cursor-wait"
          checked={read}
          disabled={readPending}
          onChange={(event) => void onToggleRead(number, event.target.checked)}
          aria-label={`Mark chapter ${number} as read`}
        />
      </label>
    </div>
  );
}
