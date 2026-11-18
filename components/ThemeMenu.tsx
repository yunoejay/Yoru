'use client';

/**
 * Theme picker UI.
 *
 * `ThemeSection` is the row that lives in the profile dropdown. On desktop,
 * hovering/focusing/clicking it opens a flyout to the left (the dropdown sits
 * at the right edge of the navbar); below `md` the list expands inline instead,
 * because a left-side flyout would run off a phone screen.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import {
  DEFAULT_THEME,
  SYSTEM_PREFERENCE,
  THEMES,
  getTheme,
  themeSwatches,
  type Theme,
} from '@/lib/themes';
import {
  getPreference,
  getServerPreference,
  setPreference,
  subscribe,
} from '@/lib/theme-store';

/** Dark → light → brand, so "Follow system" reads as a system-level choice. */
const SYSTEM_SWATCHES: [string, string, string] = ['#0f1115', '#f8fafc', '#6366f1'];

function PaletteIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
    >
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17h1.2a2.3 2.3 0 0 0 1.6-3.9 1.8 1.8 0 0 1 1.3-3.1h1.4a2.9 2.9 0 0 0 2.9-2.9A8.5 8.5 0 0 0 12 3.5Z" />
      <circle cx="8.4" cy="10.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.7" cy="10.1" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Swatches({ colors }: { colors: [string, string, string] }) {
  return (
    <span aria-hidden className="flex shrink-0 items-center -space-x-1.5">
      {colors.map((color) => (
        <span
          key={color}
          className="h-4 w-4 rounded-full border border-black/10 dark:border-white/20"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

function Option({
  label,
  swatches,
  active,
  onSelect,
}: {
  label: string;
  swatches: [string, string, string];
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      data-theme-option
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition',
        active
          ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white'
          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5',
      )}
    >
      <Swatches colors={swatches} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {active ? (
        <span aria-hidden className="text-xs font-semibold text-brand dark:text-brand-accent">
          ✓
        </span>
      ) : null}
    </button>
  );
}

export function ThemeOptions({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (next: string) => void;
}) {
  const groups = [
    { label: 'Dark', themes: THEMES.filter((theme) => theme.mode === 'dark') },
    { label: 'Light', themes: THEMES.filter((theme) => theme.mode === 'light') },
  ];

  return (
    <div>
      {groups.map((group) => (
        <div key={group.label} className="pb-1">
          <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {group.label}
          </p>
          {group.themes.map((theme: Theme) => (
            <Option
              key={theme.id}
              label={theme.name}
              swatches={themeSwatches(theme)}
              active={active === theme.id}
              onSelect={() => onSelect(theme.id)}
            />
          ))}
        </div>
      ))}
      <div className="border-t border-slate-200 pt-1 dark:border-white/10">
        <Option
          label="Follow system"
          swatches={SYSTEM_SWATCHES}
          active={active === SYSTEM_PREFERENCE}
          onSelect={() => onSelect(SYSTEM_PREFERENCE)}
        />
      </div>
    </div>
  );
}

export default function ThemeSection({ variant = 'flyout' }: { variant?: 'flyout' | 'inline' }) {
  const preference = useSyncExternalStore(subscribe, getPreference, getServerPreference);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);

  const flyout = variant === 'flyout';
  const currentTheme = getTheme(preference);
  const label =
    preference === SYSTEM_PREFERENCE ? 'Follow system' : currentTheme?.name ?? DEFAULT_THEME.name;

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  function clearCloseTimer() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  /** Small grace period so the pointer can travel from the row into the flyout. */
  function scheduleClose() {
    if (!flyout) return;
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  }

  function focusActiveOption() {
    const panel = panelRef.current;
    if (!panel) return;

    const target =
      panel.querySelector<HTMLElement>('[data-theme-option][aria-checked="true"]') ??
      panel.querySelector<HTMLElement>('[data-theme-option]');
    target?.focus();
  }

  /** With 15 palettes the list scrolls; show the reader their current theme. */
  function handlePanelRef(node: HTMLDivElement | null) {
    panelRef.current = node;
    if (!node || !flyout) return;

    const active = node.querySelector<HTMLElement>('[data-theme-option][aria-checked="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }

  function openMenu(focusOption: boolean) {
    clearCloseTimer();
    setOpen(true);
    if (focusOption) window.requestAnimationFrame(focusActiveOption);
  }

  function closeMenu(restoreFocus: boolean) {
    clearCloseTimer();
    setOpen(false);
    if (restoreFocus) rowRef.current?.focus();
  }

  function handleRowKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowRight') {
      event.preventDefault();
      openMenu(true);
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    }
  }

  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' || event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
      return;
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

    const options = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('[data-theme-option]') ?? [],
    );
    if (options.length === 0) return;

    event.preventDefault();
    const index = options.indexOf(document.activeElement as HTMLElement);
    let nextIndex = 0;

    if (event.key === 'ArrowDown') nextIndex = index < 0 ? 0 : (index + 1) % options.length;
    else if (event.key === 'ArrowUp') nextIndex = index <= 0 ? options.length - 1 : index - 1;
    else if (event.key === 'End') nextIndex = options.length - 1;

    options[nextIndex]?.focus();
  }

  function handleBlur(event: ReactFocusEvent<HTMLDivElement>) {
    if (!flyout) return;

    const next = event.relatedTarget as Node | null;
    if (!wrapperRef.current?.contains(next)) closeMenu(false);
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={flyout ? () => openMenu(false) : undefined}
      onMouseLeave={flyout ? scheduleClose : undefined}
      onBlur={handleBlur}
    >
      <button
        ref={rowRef}
        type="button"
        role={flyout ? 'menuitem' : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? closeMenu(false) : openMenu(false))}
        onKeyDown={handleRowKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
      >
        <span className="flex min-w-0 items-center gap-2">
          <PaletteIcon />
          <span>Theme</span>
        </span>
        <span className="flex min-w-0 items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="max-w-[7.5rem] truncate">{label}</span>
          <span aria-hidden className={cn('text-[10px] transition-transform', open && 'rotate-90')}>
            ▸
          </span>
        </span>
      </button>

      {open ? (
        <div
          ref={handlePanelRef}
          role="menu"
          aria-label="Theme"
          onKeyDown={handlePanelKeyDown}
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40 md:absolute md:right-full md:top-0 md:mr-2 md:mt-0 md:max-h-[min(26rem,70vh)] md:w-60 md:overflow-y-auto"
        >
          <ThemeOptions
            active={preference}
            onSelect={(next) => {
              setPreference(next);
              if (!flyout) closeMenu(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
