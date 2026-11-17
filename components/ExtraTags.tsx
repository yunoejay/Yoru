'use client';

import { useEffect, useRef, useState } from 'react';

interface ExtraTagsProps {
  /** The long tail of tags revealed behind the toggle (themes / formats / etc). */
  tags: string[];
}

/**
 * Collapsible "More tags" control for a series' extra tag list.
 *
 * The genres stay inline, but a manhwa's non-genre tags (MangaDex
 * theme/format/content, MangaBaka's loose tags) routinely run to a dozen
 * entries and turn the hero into a wall of pills. Those live behind this
 * toggle, which expands *in place* — deliberately not a floating popover,
 * because the hero panel is `overflow-hidden` and would clip one.
 */
export default function ExtraTags({ tags }: ExtraTagsProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on Escape or a click/tap outside the control, but only while open.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  if (!tags.length) return null;

  return (
    <div ref={rootRef}>
      <button
        type="button"
        className="chip chip-toggle"
        aria-expanded={open}
        aria-controls="series-extra-tags"
        onClick={() => setOpen(prev => !prev)}
      >
        {open ? 'Fewer tags' : `More tags (${tags.length})`}
        <svg
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path
            d="M5 7.5 10 12.5 15 7.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <ul
          id="series-extra-tags"
          className="mt-2 flex flex-wrap gap-1.5"
        >
          {tags.map(tag => (
            <li key={tag}>
              <span className="chip">{tag}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
