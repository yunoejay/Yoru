'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LIBRARY_STATUSES,
  LIBRARY_STATUS_DOT,
  LIBRARY_STATUS_LABELS,
  isLibraryStatus,
  type LibraryStatus,
} from '@/lib/library-status';

/** Width of the status menu in px. Keep in sync with the `w-56` class below. */
const MENU_WIDTH = 224;
/** Gap between the trigger and the menu. */
const MENU_GAP = 8;
/** Margin the menu keeps from the viewport edges. */
const VIEWPORT_MARGIN = 8;

/** Viewport coordinates for the portaled status menu. */
interface MenuPosition {
  top: number;
  left: number;
  maxHeight: number;
}

interface LibraryButtonProps {
  /** Public series id (slug or uuid), the same value used in /series/[id]. */
  seriesId: string;
  /** Server-seeded session state so the control is correct on first paint. */
  isSignedIn: boolean;
  /** The reader's current status, or null when the series is not in the library. */
  initialStatus: LibraryStatus | null;
  /** Compact variant for the /my-library card grid. */
  compact?: boolean;
}

/**
 * The personal-bookmarks control: a status menu that doubles as the "add" button.
 *
 * Signed-out visitors get a link to the login page. Signed-in readers pick one
 * of LIBRARY_STATUSES (upsert via PUT /api/library) or remove the series
 * (DELETE /api/library/<id>). Updates are optimistic and roll back on failure;
 * `router.refresh()` then re-renders server data such as the /my-library grid
 * and the home rails.
 */
export default function LibraryButton({
  seriesId,
  isSignedIn,
  initialStatus,
  compact = false,
}: LibraryButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<LibraryStatus | null>(initialStatus);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  // Same dismissal behaviour as the navbar avatar menu: outside click or Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      // The menu is portaled to <body>, so it is not a DOM descendant of the
      // trigger wrapper; both have to be checked or selecting an option would
      // close the menu on mousedown before the click ever landed.
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
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
  }, [open]);

  /**
   * The status menu renders in a portal on <body> and is placed with `fixed`
   * viewport coordinates. It used to be `absolute` inside this wrapper, which
   * meant `overflow-hidden` on the series page's hero card (`hero-panel`)
   * clipped it — the menu appeared cut off, stuck inside the card. Fixed
   * coordinates also keep it on screen under the narrow covers on /my-library,
   * where the 224px menu is wider than a grid column.
   */
  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Compact buttons sit in a narrow grid column, so align the menu's right
    // edge with the trigger; the full-size one opens left-to-right. Either way
    // the result is clamped so the menu never leaves the viewport.
    const preferredLeft = compact ? rect.right - MENU_WIDTH : rect.left;
    const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - MENU_WIDTH - VIEWPORT_MARGIN);
    const left = Math.min(Math.max(preferredLeft, VIEWPORT_MARGIN), maxLeft);

    const spaceBelow = viewportHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;
    // Flip above the trigger only when the menu genuinely does not fit below.
    const openAbove = menuHeight > 0 && spaceBelow < menuHeight && spaceAbove > spaceBelow;

    setMenuPosition({
      top: openAbove
        ? Math.max(VIEWPORT_MARGIN, rect.top - MENU_GAP - menuHeight)
        : rect.bottom + MENU_GAP,
      left,
      // Caps the height and lets the list scroll instead of overflowing.
      maxHeight: Math.max(160, openAbove ? spaceAbove : spaceBelow),
    });
  }, [compact]);

  // Position on open, then follow scroll and resize. Scroll is captured so
  // nested scrollers (the genre/scanlator rails) keep the menu anchored too.
  useEffect(() => {
    if (!open) return;

    // One painted frame after the menu mounts, so its real height is known when
    // deciding whether to flip it above the trigger. Deferring also keeps the
    // state update out of the commit path (react-hooks/set-state-in-effect);
    // the menu stays `visibility: hidden` until `menuPosition` is set.
    let frame = requestAnimationFrame(positionMenu);

    const onReposition = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(positionMenu);
    };
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);

    // Layout can move without a scroll event — late web fonts, a cover image
    // finishing, the /my-library filter re-rendering the grid — which would
    // otherwise leave the menu anchored to a stale rectangle.
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onReposition);
    if (observer) {
      if (triggerRef.current) observer.observe(triggerRef.current);
      observer.observe(document.body);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [open, positionMenu]);

  if (!isSignedIn) {
    return (
      <Link
        href="/login"
        title="Log in to add this series to your bookmarks"
        className={controlClass(compact, false)}
      >
        <span aria-hidden>＋</span> Add to bookmarks
      </Link>
    );
  }

  async function changeStatus(next: LibraryStatus) {
    if (pending) return;
    const previous = status;
    setPending(true);
    setOpen(false);
    setStatus(next); // optimistic

    try {
      const res = await fetch('/api/library', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesId, status: next }),
      });

      if (res.status === 401) {
        setStatus(previous);
        router.push('/login');
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !isLibraryStatus(data?.status)) {
        setStatus(previous);
        return;
      }

      setStatus(data.status);
      router.refresh();
    } catch {
      setStatus(previous);
    } finally {
      setPending(false);
    }
  }

  async function removeFromLibrary() {
    if (pending || !status) return;
    const previous = status;
    setPending(true);
    setOpen(false);
    setStatus(null); // optimistic

    try {
      const res = await fetch(`/api/library/${encodeURIComponent(seriesId)}`, {
        method: 'DELETE',
      });

      if (res.status === 401) {
        setStatus(previous);
        router.push('/login');
        return;
      }
      if (!res.ok) {
        setStatus(previous);
        return;
      }
      router.refresh();
    } catch {
      setStatus(previous);
    } finally {
      setPending(false);
    }
  }

  /**
   * Toggles the menu, dropping the previous coordinates first so a reopened
   * menu is never drawn at a stale spot. It stays hidden until `positionMenu`
   * has measured and placed it.
   */
  function toggleMenu() {
    setMenuPosition(null);
    setOpen(current => !current);
  }

  const inLibrary = status !== null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={inLibrary ? `Bookmark status: ${LIBRARY_STATUS_LABELS[status]}` : 'Add to bookmarks'}
        className={controlClass(compact, inLibrary)}
      >
        {inLibrary ? (
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${LIBRARY_STATUS_DOT[status]}`}
            aria-hidden
          />
        ) : (
          <span aria-hidden>＋</span>
        )}
        <span className="truncate">
          {inLibrary ? LIBRARY_STATUS_LABELS[status] : 'Add to bookmarks'}
        </span>
        <span aria-hidden className="text-[10px] opacity-70">
          ▾
        </span>
      </button>

      {/* Portaled to <body> so no ancestor's `overflow-hidden` (the series hero
          card) can clip the menu; coordinates come from `positionMenu`. */}
      {open ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Reading status"
          style={{
            top: menuPosition?.top,
            left: menuPosition?.left,
            maxHeight: menuPosition?.maxHeight,
            visibility: menuPosition ? 'visible' : 'hidden',
          }}
          className="fixed z-50 w-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40"
        >
          <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Reading status
          </p>
          <div className="p-1">
            {LIBRARY_STATUSES.map(option => {
              const active = status === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  disabled={pending}
                  onClick={() => void changeStatus(option)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition disabled:opacity-60 ${
                    active
                      ? 'bg-brand/10 font-medium text-brand dark:bg-brand/15 dark:text-brand-accent'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${LIBRARY_STATUS_DOT[option]}`}
                    aria-hidden
                  />
                  <span className="flex-1">{LIBRARY_STATUS_LABELS[option]}</span>
                  {active ? (
                    <span aria-hidden className="text-xs">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {inLibrary ? (
            <div className="border-t border-slate-200 p-1 dark:border-white/10">
              <button
                type="button"
                role="menuitem"
                disabled={pending}
                onClick={() => void removeFromLibrary()}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-500/10"
              >
                <span aria-hidden>✕</span> Remove from bookmarks
              </button>
            </div>
          ) : null}
        </div>,
        document.body
      ) : null}
    </div>
  );
}

/**
 * The bookmark control sits next to the chapter buttons on a series page and
 * under each cover on /my-library. The compact variant styles itself because
 * `.btn-ghost`'s dark rules outrank plain utilities; the active tint therefore
 * uses `!` utilities in the full-size variant.
 */
function controlClass(compact: boolean, inLibrary: boolean): string {
  if (compact) {
    return [
      'flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60',
      inLibrary
        ? 'border-brand/40 bg-brand/10 text-brand hover:bg-brand/15 dark:border-brand-accent/40 dark:bg-brand-accent/10 dark:text-brand-accent dark:hover:bg-brand-accent/15'
        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10',
    ].join(' ');
  }

  return [
    'btn-ghost disabled:opacity-60',
    inLibrary ? '!border-brand/50 !bg-brand/15 !text-brand dark:!text-brand-accent' : '',
  ].join(' ');
}

