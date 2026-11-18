"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ChapterRef {
  id: string;
  number: number;
  title: string | null;
}

interface Props {
  seriesId: string;
  seriesTitle: string;
  heading: string;
  chapterNumber: number;
  scanlator?: string | null;
  creditGroup?: string | null;
  sourceName?: string | null;
  currentPage: number;
  total: number;
  progress: number;
  prevChapter: ChapterRef | null;
  nextChapter: ChapterRef | null;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  quality: "data" | "data-saver";
  onQualityChange: (quality: "data" | "data-saver") => void;
  autoplay: boolean;
  onAutoplayChange: (autoplay: boolean) => void;
  /** Whether this chapter number is marked read. */
  read: boolean;
  onReadChange: (read: boolean) => void;
  readPending: boolean;
  busy: boolean;
}

const railButtonClass =
  "flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30";

function Icon({ name }: { name: "back" | "list" | "up" | "down" | "settings" | "expand" }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      {name === "back" ? (
        <>
          <path d="M19 12H5" />
          <path d="m11 18-6-6 6-6" />
        </>
      ) : null}
      {name === "list" ? (
        <>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </>
      ) : null}
      {name === "up" ? <path d="m6 14 6-6 6 6" /> : null}
      {name === "down" ? <path d="m6 10 6 6 6-6" /> : null}
      {name === "expand" ? (
        <>
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M16 3h3a2 2 0 0 1 2 2v3" />
          <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </>
      ) : null}
      {name === "settings" ? (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.38.4.72.74.96.33.24.73.37 1.14.37H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.67Z" />
        </>
      ) : null}
    </svg>
  );
}
function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-xs transition hover:bg-white/[0.06]">
      <span>
        <span className="block font-medium text-slate-200">{label}</span>
        {hint ? <span className="block text-[10px] text-slate-500">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        className="h-4 w-4 accent-brand disabled:cursor-wait"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

/**
 * Immersive reader chrome: a compact icon rail on the LEFT edge plus a floating
 * settings panel that opens beside it.
 *
 * The reader itself is pure black with the chapter centered; this keeps every
 * control (chapter navigation, progress, auto-scroll, mark read, low data,
 * fullscreen) out of the reading column until the reader wants it. The panel
 * closes on Escape or an outside click, and the rail sits above the image strip
 * so it never blocks the panels.
 */
export default function ReaderControls({
  seriesId,
  seriesTitle,
  heading,
  chapterNumber,
  scanlator,
  creditGroup,
  sourceName,
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
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Outside click / Escape closes the settings panel, like the navbar menus.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (railRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Safari/iOS can refuse fullscreen for a document; the reader still works.
    }
  }, []);

  const credit = scanlator ?? creditGroup;
  return (
    <>
      <div
        ref={railRef}
        className="fixed left-3 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-0.5 rounded-2xl border border-white/10 bg-black/80 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-md sm:left-4"
      >
        <Link
          href={`/series/${seriesId}`}
          className={railButtonClass}
          title={`Back to ${seriesTitle}`}
          aria-label={`Back to ${seriesTitle}`}
        >
          <Icon name="back" />
        </Link>
        <Link
          href={`/series/${seriesId}#chapter-${chapterNumber}`}
          className={railButtonClass}
          title="Chapter list"
          aria-label="Chapter list"
        >
          <Icon name="list" />
        </Link>
        <span className="my-1 h-px bg-white/10" aria-hidden />
        <button
          type="button"
          onClick={onPrevChapter}
          disabled={!prevChapter || busy}
          className={railButtonClass}
          title={prevChapter ? `Previous chapter (Ch. ${prevChapter.number})` : "No previous chapter"}
          aria-label="Previous chapter"
        >
          <Icon name="up" />
        </button>
        <button
          type="button"
          onClick={onNextChapter}
          disabled={!nextChapter || busy}
          className={railButtonClass}
          title={nextChapter ? `Next chapter (Ch. ${nextChapter.number})` : "No next chapter"}
          aria-label="Next chapter"
        >
          <Icon name="down" />
        </button>
        <span className="my-1 h-px bg-white/10" aria-hidden />
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={`${railButtonClass} ${open ? "bg-white/10 text-white" : ""}`}
          title="Reader settings"
          aria-label="Reader settings"
          aria-expanded={open}
        >
          <Icon name="settings" />
        </button>
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          className={railButtonClass}
          title={fullscreen ? "Exit full screen" : "Full screen"}
          aria-label={fullscreen ? "Exit full screen" : "Full screen"}
        >
          <Icon name="expand" />
        </button>
      </div>
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Reader settings"
          className="fixed left-[4.5rem] top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[min(20rem,calc(100vw-5.5rem))] -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-slate-200 shadow-2xl shadow-black/70 backdrop-blur-xl sm:left-[5rem]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Now reading
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-white">{heading}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">{seriesTitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close settings"
            >
              ✕
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{total ? `Page ${Math.min(currentPage, total)} / ${total}` : "Loading pages…"}</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-brand-accent transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onPrevChapter}
              disabled={!prevChapter || busy}
              className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ← {prevChapter ? `Ch. ${prevChapter.number}` : "Start"}
            </button>
            <button
              type="button"
              onClick={onNextChapter}
              disabled={!nextChapter || busy}
              className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {nextChapter ? `Ch. ${nextChapter.number}` : "End"} →
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <ToggleRow
              label="Auto-scroll"
              hint="One page every 5 seconds"
              checked={autoplay}
              disabled={total === 0 || busy}
              onChange={onAutoplayChange}
            />
            <ToggleRow
              label="Mark chapter read"
              checked={read}
              disabled={readPending}
              onChange={onReadChange}
            />
            <ToggleRow
              label="Low data"
              hint="Load compressed page images"
              checked={quality === "data-saver"}
              onChange={(checked) => onQualityChange(checked ? "data-saver" : "data")}
            />
          </div>

          {credit || sourceName ? (
            <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-5 text-slate-500">
              Scanlation: <span className="text-slate-300">{credit ?? "Unknown group"}</span>
              {sourceName ? ` via ${sourceName}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
