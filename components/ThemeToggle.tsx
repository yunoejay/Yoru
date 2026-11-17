"use client";
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme') || 'dark';
    const isDark = stored === 'dark';
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');

    // Trigger a change event for any listeners
    window.dispatchEvent(new CustomEvent('themechange', { detail: { dark: next } }));
  }

  // Always render the same-width button so the navbar does not jump on mount.
  return (
    <button
      onClick={toggle}
      aria-label={mounted && dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={mounted && dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="theme-toggle inline-flex h-9 w-9 items-center justify-center rounded-full border text-base transition"
    >
      {mounted ? (dark ? '☀' : '☾') : <span aria-hidden>◐</span>}
    </button>
  );
}

