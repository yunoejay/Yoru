"use client";

export interface ChapterRef {
  id: string;
  number: number;
  title: string | null;
}

interface Props {
  currentPage: number;
  total: number;
  progress: number;
  prevChapter: ChapterRef | null;
  nextChapter: ChapterRef | null;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  quality: 'data' | 'data-saver';
  onQualityChange: (quality: 'data' | 'data-saver') => void;
  autoplay: boolean;
  onAutoplayChange: (autoplay: boolean) => void;
  /** Whether this chapter number is marked read. */
  read: boolean;
  onReadChange: (read: boolean) => void;
  readPending: boolean;
  busy: boolean;
}

const buttonClass =
  'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10';

export default function ReaderControls({
  currentPage,
  total,
  progress,
  prevChapter,
  nextChapter,
  onPrevChapter,
  onNextChapter,
  quality,
  onQualityChange,
  autoplay,
  onAutoplayChange,
  read,
  onReadChange,
  readPending,
  busy,
}: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-slate-950/90">
      <div className="h-1 w-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-brand to-brand-accent transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs">
        <button
          onClick={onPrevChapter}
          disabled={!prevChapter || busy}
          className={buttonClass}
          title="Previous chapter (←)"
        >
          ← {prevChapter ? `Ch. ${prevChapter.number}` : 'Start'}
        </button>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-slate-500 dark:text-slate-400">
            {total ? `page ${Math.min(currentPage, total)} / ${total} · ${progress}%` : '—'}
          </span>

          <button
            onClick={() => onAutoplayChange(!autoplay)}
            disabled={total === 0}
            className={
              autoplay
                ? `${buttonClass} border-brand/60 bg-brand/10 text-brand dark:border-brand-accent/50 dark:text-brand-accent`
                : buttonClass
            }
            title={
              autoplay
                ? 'Pause auto-scroll (one page every 5s)'
                : 'Auto-scroll one page every 5s'
            }
          >
            {autoplay ? '❚❚ Auto' : '▶ Auto'}
          </button>

          <label className="flex cursor-pointer items-center gap-2 text-slate-500 dark:text-slate-400" title="Mark this chapter as read">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-brand disabled:cursor-wait"
              checked={read}
              disabled={readPending}
              onChange={event => onReadChange(event.target.checked)}
            />
            mark read
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-slate-500 dark:text-slate-400" title="Load the compressed variant of each page">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-brand"
              checked={quality === 'data-saver'}
              onChange={event => onQualityChange(event.target.checked ? 'data-saver' : 'data')}
            />
            low data
          </label>
        </div>

        <button
          onClick={onNextChapter}
          disabled={!nextChapter || busy}
          className={buttonClass}
          title="Next chapter (→)"
        >
          {nextChapter ? `Ch. ${nextChapter.number}` : 'End'} →
        </button>
      </div>
    </div>
  );
}

