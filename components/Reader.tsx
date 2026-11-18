'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReaderControls, { type ChapterRef } from './ReaderControls';
import { useReadProgress } from './useReadProgress';
import { markSeriesReading } from '@/lib/reading-status-client';

interface PagesResponse {
  total: number;
  pages: string[];
  demo: boolean;
  scanlator: string | null;
  attribution?: { source: string | null; group: string | null };
  error?: string;
  linkOutUrl?: string | null;
}

interface Props {
  chapterId: string;
  seriesId: string;
  seriesTitle: string;
  heading: string;
  /** Scanlator credited for this chapter, known server-side. */
  creditGroup?: string | null;
  /** Only used by the bundled demo chapters, which carry their own images. */
  demoPages?: string[];
  /** Story position, used for the "mark chapter read" control. */
  chapterNumber?: number;
  /** Server-seeded so the read checkbox is correct on first paint. */
  isSignedIn?: boolean;
  initialReadNumbers?: number[];
  prevChapter?: ChapterRef | null;
  nextChapter?: ChapterRef | null;
}

/** How long auto-play rests on each page before scrolling to the next one. */
const AUTOPLAY_INTERVAL_MS = 5000;

export default function Reader({
  chapterId,
  seriesId,
  seriesTitle,
  heading,
  creditGroup = null,
  demoPages = [],
  chapterNumber = 0,
  isSignedIn = false,
  initialReadNumbers = [],
  prevChapter = null,
  nextChapter = null,
}: Props) {

  const hasDemoPages = demoPages.length > 0;
  const router = useRouter();
  const {
    isRead,
    toggleRead,
    pending: readPending,
  } = useReadProgress({ seriesId, isSignedIn, initialReadNumbers });

  const [pages, setPages] = useState<string[]>(demoPages);
  const [scanlator, setScanlator] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(!hasDemoPages);
  const [error, setError] = useState<string | null>(null);
  const [linkOutUrl, setLinkOutUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState<'data' | 'data-saver'>('data');
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [autoplay, setAutoplay] = useState(false);

  const stripRef = useRef<HTMLDivElement>(null);
  const prefetchedRef = useRef<string | null>(null);
  // Guards the "opened a chapter" write against StrictMode's double effect.
  const readingMarkedRef = useRef<string | null>(null);
  // Mirror of currentPage for the auto-play timer, which must read the live page
  // without re-subscribing on every scroll. Kept in sync by an effect below.
  const currentPageRef = useRef(1);
  // Monotonic id so a slow response for a previous chapter cannot ever paint
  // over the current one (rapid chapter/quality changes).
  const loadIdRef = useRef(0);

  const load = useCallback(
    async (requested: 'data' | 'data-saver') => {
      if (hasDemoPages) return;
      const loadId = ++loadIdRef.current;
      // Drop the previous chapter's strip immediately: never show a foreign
      // chapter's pages while this one is still resolving upstream.
      setLoading(true);
      setError(null);
      setPages([]);
      setScanlator(null);
      setSourceName(null);
      setLinkOutUrl(null);
      try {
        const response = await fetch(`/api/chapter/${chapterId}/pages?quality=${requested}`);
        const data = (await response.json()) as PagesResponse;
        if (loadId !== loadIdRef.current) return;
        if (!response.ok) {
          setError(data.error || 'Could not load this chapter.');
          setLinkOutUrl(data.linkOutUrl ?? null);
          setPages([]);
          return;
        }
        setPages(data.pages);
        setScanlator(data.scanlator ?? data.attribution?.group ?? null);
        setSourceName(data.attribution?.source ?? null);
        setLinkOutUrl(null);
      } catch {
        if (loadId !== loadIdRef.current) return;
        setError('Network error while resolving pages.');
      } finally {
        if (loadId === loadIdRef.current) setLoading(false);
      }
    },
    [chapterId, hasDemoPages]
  );

  useEffect(() => {
    void load(quality);
  }, [load, quality]);

  const goToChapter = useCallback(
    (chapter: ChapterRef | null) => {
      if (chapter) router.push(`/reader/${seriesId}/${chapter.id}`);
    },
    [router, seriesId]
  );

  // Every chapter starts at the top of the strip, on page one.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setProgress(0);
    setCurrentPage(1);
    currentPageRef.current = 1;
  }, [chapterId]);

  // Opening a chapter means the reader is reading the series, so file it as
  // "Reading" (the API keeps an existing reading/rereading status untouched).
  // This is what shelves a title the reader already read on another site the
  // moment they open chapter 1 - or any other chapter. One POST per chapter
  // view, so Prev/Next navigation keeps the status current; guests skip it
  // because a shelf status belongs to an account.
  useEffect(() => {
    if (!isSignedIn) return;
    const key = `${seriesId}:${chapterId}`;
    if (readingMarkedRef.current === key) return;
    readingMarkedRef.current = key;
    markSeriesReading(seriesId);
  }, [chapterId, isSignedIn, seriesId]);

  // Keep the ref the auto-play timer reads pointed at the page under the anchor,
  // whether it changed from a scroll or an auto-play step.
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Scroll progress + which page sits under the reading anchor.
  useEffect(() => {
    if (!pages.length) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const viewport = window.innerHeight;
      const scrollable = document.documentElement.scrollHeight - viewport;
      setProgress(scrollable > 0 ? Math.min(100, Math.round((window.scrollY / scrollable) * 100)) : 100);

      const anchor = viewport * 0.4;
      const images = stripRef.current?.querySelectorAll('img[data-page]');
      if (images && images.length) {
        let current = 1;
        images.forEach(image => {
          const element = image as HTMLImageElement;
          if (element.getBoundingClientRect().top <= anchor) current = Number(element.dataset.page);
        });
        setCurrentPage(current);
      }
    };

    const requestMeasure = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    // Lazy <img>s report a real height only once decoded, which changes the
    // strip's height and the "end of chapter" position. Images fire a load
    // event (captured here in the capture phase) so we re-measure as each page
    // comes in, instead of waiting for the next scroll/resize.
    const onImageLoad = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.getAttribute('data-page')) requestMeasure();
    };

    window.addEventListener('scroll', requestMeasure, { passive: true });
    window.addEventListener('resize', requestMeasure);
    window.addEventListener('load', onImageLoad, true);
    measure();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', requestMeasure);
      window.removeEventListener('resize', requestMeasure);
      window.removeEventListener('load', onImageLoad, true);
    };
  }, [pages]);

  // Left/Right move between chapters. Up/Down/Space are deliberately untouched so
  // the browser keeps scrolling natively.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToChapter(nextChapter);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToChapter(prevChapter);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToChapter, nextChapter, prevChapter]);

  // Auto-play: while enabled, scroll down one page every AUTOPLAY_INTERVAL_MS.
  // It stops at the last page and never advances chapters; a manual wheel/touch
  // restarts the timer so it never yanks the page while the reader is scrolling.
  useEffect(() => {
    const pageCount = pages.length;
    if (!autoplay || loading || error || pageCount === 0) return;

    const scrollNextPage = () => {
      const images = stripRef.current?.querySelectorAll('img[data-page]');
      if (!images || images.length === 0) return;
      const next = currentPageRef.current + 1;
      if (next > pageCount) {
        setAutoplay(false);
        return;
      }
      const target = images[next - 1] as HTMLImageElement | undefined;
      if (!target) return;
      // The image's own top is positioned by the (already loaded) pages above it,
      // so this stays correct even while the target itself is still lazy-loading.
      window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY,
        behavior: 'smooth',
      });
      setCurrentPage(next);
    };

    let timer = window.setInterval(scrollNextPage, AUTOPLAY_INTERVAL_MS);
    const restart = () => {
      window.clearInterval(timer);
      timer = window.setInterval(scrollNextPage, AUTOPLAY_INTERVAL_MS);
    };

    window.addEventListener('wheel', restart, { passive: true });
    window.addEventListener('touchstart', restart, { passive: true });

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('wheel', restart);
      window.removeEventListener('touchstart', restart);
    };
  }, [autoplay, loading, error, pages]);

  // Warm the next chapter's server-side page cache so flipping chapters feels
  // instant. One upstream manifest call; no image bytes.
  useEffect(() => {
    if (loading || error || !nextChapter || prefetchedRef.current === nextChapter.id) return;
    const target = nextChapter.id;
    const timer = window.setTimeout(() => {
      prefetchedRef.current = target;
      void fetch(`/api/chapter/${target}/pages?quality=${quality}`).catch(() => undefined);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [loading, error, nextChapter, quality]);

  const total = pages.length;

  return (
    <div className="pb-28">
      {/* Breadcrumb + back-to-series affordance. */}
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-3">
        <Link href={`/series/${seriesId}`} className="btn-ghost !px-3 !py-1.5 text-xs">
          ← {seriesTitle}
        </Link>
        {scanlator || creditGroup ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Scanlation:{' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">{scanlator ?? creditGroup}</span>
            {sourceName ? ` via ${sourceName}` : ''}
          </span>
        ) : null}
      </div>

      <div className="mx-auto mb-6 max-w-3xl">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl">{heading}</h1>
      </div>

      {loading ? (
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
          <div className="skeleton h-72 w-full" />
          <div className="skeleton h-72 w-full opacity-70" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading chapter…</p>
        </div>
      ) : null}

      {error ? (
        <div className="alert alert-error mx-auto max-w-3xl space-y-2">
          <p className="text-sm">{error}</p>
          {linkOutUrl ? (
            <a href={linkOutUrl} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium underline">
              Read this chapter at the official publisher →
            </a>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && total === 0 ? (
        <p className="mx-auto max-w-3xl text-sm text-slate-500 dark:text-slate-400">No pages for this chapter.</p>
      ) : null}

      {total ? (
        <div
          ref={stripRef}
          className="mx-auto flex w-full max-w-3xl flex-col items-stretch overflow-hidden rounded shadow"
        >
          {pages.map((src, position) => (
            <img
              key={`${chapterId}-${position}`}
              src={src}
              data-page={position + 1}
              alt={`Page ${position + 1} of ${total}`}
              loading={position < 2 ? 'eager' : 'lazy'}
              decoding="async"
              referrerPolicy="no-referrer"
              draggable={false}
              className="block h-auto w-full select-none"
            />
          ))}
        </div>
      ) : null}

      {sourceName ? (
        <p className="mx-auto mt-6 max-w-3xl text-[11px] text-slate-500">
          Content provided by {sourceName} and the credited scanlation group. Removal requests from groups
          are honoured.
        </p>
      ) : null}

      <ReaderControls
        currentPage={currentPage}
        total={total}
        progress={progress}
        prevChapter={prevChapter}
        nextChapter={nextChapter}
        onPrevChapter={() => goToChapter(prevChapter)}
        onNextChapter={() => goToChapter(nextChapter)}
        quality={quality}
        onQualityChange={setQuality}
        autoplay={autoplay}
        onAutoplayChange={setAutoplay}
        read={isRead(chapterNumber)}
        onReadChange={checked => void toggleRead(chapterNumber, checked)}
        readPending={readPending}
        busy={loading}
      />
    </div>
  );
}
