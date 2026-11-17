'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import type { SeriesSearchHit } from '@/lib/types';

/** Wait this long after the last keystroke before asking the API. */
const DEBOUNCE_MS = 180;

/** How many suggestions the dropdown asks for. */
const RESULT_LIMIT = 6;

function SearchIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16.2 16.2 4.3 4.3" />
    </svg>
  );
}

/**
 * Navbar search box with live suggestions.
 *
 * The library page filters its already-loaded catalog in the browser, but the
 * navbar exists on every route and carries no catalog in memory. Typing
 * therefore debounces a request to /api/search and lists matching series under
 * the field. Enter with a highlighted row opens it; plain Enter still submits
 * the form to /library?q=... so the full browse filters and sort apply.
 */
export default function SearchBox({
  className,
  inputClassName,
  panelClassName,
  onNavigate,
}: {
  /** Positioning classes for the wrapping <form> (it is always `relative`). */
  className?: string;
  inputClassName?: string;
  /** Override the dropdown width/offset; defaults to a right-aligned panel. */
  panelClassName?: string;
  /** Called after a result or the form is chosen (the mobile menu closes here). */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const listId = useId();
  const containerRef = useRef<HTMLFormElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SeriesSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = query.trim();
  const showPanel = open && trimmed.length > 0;

  // Debounced live search. Aborting the previous request keeps a slow response
  // from overwriting the suggestions for a newer query.
  useEffect(() => {
    // Clearing the field is handled by the input's onChange, so this effect
    // only ever starts a request for a non-empty query.
    if (!trimmed) return;

    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=${RESULT_LIMIT}`, {
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error(`Search failed with ${response.status}`);
          return response.json() as Promise<{ results?: SeriesSearchHit[] }>;
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          setResults(Array.isArray(data.results) ? data.results : []);
          setActiveIndex(-1);
          setOpen(true);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          if ((error as Error)?.name === 'AbortError') return;
          setResults([]);
          setOpen(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed]);

  // Close on a click/tap outside the field or on Escape.
  useEffect(() => {
    if (!showPanel) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showPanel]);

  // Keep the keyboard-highlighted row visible in a scrolling list.
  useEffect(() => {
    if (activeIndex < 0) return;
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function closePanel() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleSubmit() {
    closePanel();
    onNavigate?.();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      closePanel();
      return;
    }
    if (!showPanel || results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      const hit = results[activeIndex];
      closePanel();
      onNavigate?.();
      router.push(`/series/${hit.id}`);
    }
  }

  return (
    <form
      ref={containerRef}
      role="search"
      method="get"
      action="/library"
      onSubmit={handleSubmit}
      className={cn('relative', className)}
    >
      <SearchIcon />
      <input
        type="search"
        name="q"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          if (value.trim()) {
            setOpen(true);
          } else {
            setOpen(false);
            setResults([]);
            setLoading(false);
            setActiveIndex(-1);
          }
        }}
        onFocus={() => {
          if (trimmed) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search series…"
        aria-label="Search series"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showPanel}
        aria-controls={showPanel ? listId : undefined}
        aria-activedescendant={
          showPanel && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
        }
        autoComplete="off"
        className={inputClassName}
      />

      {showPanel ? (
        <div
          className={cn(
            'absolute top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40',
            panelClassName ?? 'right-0 w-[min(21rem,calc(100vw-2rem))]',
          )}
        >
          {loading && results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
              No series found for “{trimmed}”.
            </p>
          ) : (
            <>
              <ul
                id={listId}
                role="listbox"
                aria-label="Series matches"
                className="max-h-[min(22rem,60vh)] overflow-y-auto py-1"
              >
                {results.map((hit, index) => (
                  <li key={hit.id} role="presentation">
                    <Link
                      ref={(node) => {
                        itemRefs.current[index] = node;
                      }}
                      id={`${listId}-option-${index}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      href={`/series/${hit.id}`}
                      onClick={() => {
                        closePanel();
                        onNavigate?.();
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 transition',
                        index === activeIndex
                          ? 'bg-slate-100 dark:bg-white/10'
                          : 'hover:bg-slate-50 dark:hover:bg-white/5',
                      )}
                    >
                      <img
                        src={hit.cover}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-14 w-10 shrink-0 rounded-md border border-slate-200 object-cover dark:border-white/10"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {hit.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
                          {[
                            hit.author,
                            `${hit.chapterCount} ${hit.chapterCount === 1 ? 'chapter' : 'chapters'}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-white/10 dark:text-slate-300">
                        {hit.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={`/library?q=${encodeURIComponent(trimmed)}`}
                onClick={() => {
                  closePanel();
                  onNavigate?.();
                }}
                className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2.5 text-xs font-semibold text-brand transition hover:bg-slate-50 dark:border-white/10 dark:text-brand-accent dark:hover:bg-white/5"
              >
                <span>See all results for “{trimmed}”</span>
                <span aria-hidden>→</span>
              </Link>
            </>
          )}
        </div>
      ) : null}
    </form>
  );
}
