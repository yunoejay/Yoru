"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import SearchBox from "./SearchBox";
import { notifyAuthChanged, useSessionUser, type SessionUser } from "./useSessionUser";
import { profileDisplayName } from "@/lib/profile";

const avatarFallbackClass =
  "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-accent font-bold text-white";

const dropdownItemClass =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10";

function Avatar({ user, className }: { user: SessionUser; className: string }) {
  const label = profileDisplayName(user);
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        className={`${className} shrink-0 rounded-full border border-black/5 object-cover dark:border-white/10`}
      />
    );
  }
  return (
    <span className={`${className} ${avatarFallbackClass}`} aria-hidden>
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function Navbar() {
  const router = useRouter();
  const { user, loaded } = useSessionUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close the profile dropdown on Escape or a click/tap outside it.
  useEffect(() => {
    if (!profileOpen) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setProfileOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setProfileOpen(false);
    setMenuOpen(false);
    // Tell the shared session hook to drop the user, so the navbar swaps back
    // to the Login link immediately instead of on the next reload.
    notifyAuthChanged();
    router.replace('/');
    router.refresh();
  }

  const displayName = user ? profileDisplayName(user) : '';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
      <div className="container-padded flex h-16 items-center justify-between gap-4">
        <Link href="/" className="inline-flex items-center gap-3 text-slate-900 dark:text-white">
          <img src="/icon.svg" alt="" aria-hidden="true" className="h-9 w-9" />
          <span>
            <span className="block text-sm font-semibold tracking-[0.24em] text-slate-500 dark:text-slate-400">YORU</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          <Link href="/" className="nav-link">Home</Link>
          <Link href="/library" className="nav-link">Browse</Link>
        </nav>

        <div className="flex items-center gap-2">
          {/* Header search with live suggestions from /api/search. Hidden on
              small screens; the mobile menu below carries its own copy. */}
          <SearchBox
            className="hidden md:block"
            inputClassName="field-input h-10 w-44 !pl-9 lg:w-56"
          />

          {/* While the session is loading, render a neutral placeholder rather
              than the Login link: showing it to a signed-in reader was the
              "button is still there after login" bug. */}
          {!loaded ? (
            <span
              className="hidden h-9 w-16 animate-pulse rounded-full bg-slate-200 sm:block dark:bg-white/10"
              aria-hidden
            />
          ) : user ? (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen(open => !open)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label="Open profile menu"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 text-slate-800 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
              >
                <Avatar user={user} className="h-8 w-8 text-xs" />
                <span className="hidden max-w-[9rem] truncate text-xs font-medium sm:inline">
                  {displayName}
                </span>
                <span aria-hidden className="text-[10px] text-slate-500 dark:text-slate-400">
                  ▾
                </span>
              </button>

              {profileOpen ? (
                <div
                  role="menu"
                  aria-label="Account"
                  className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40"
                >
                  <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
                    <Avatar user={user} className="h-10 w-10 text-sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {displayName}
                      </p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {user.name ? `@${user.name}` : user.email}
                      </p>
                    </div>
                  </div>
                  <div className="p-2">
                    <Link
                      role="menuitem"
                      href="/account"
                      onClick={() => setProfileOpen(false)}
                      className={dropdownItemClass}
                    >
                      My profile
                    </Link>
                    <Link
                      role="menuitem"
                      href="/my-library"
                      onClick={() => setProfileOpen(false)}
                      className={dropdownItemClass}
                    >
                      Bookmarks
                    </Link>
                    <button
                      role="menuitem"
                      type="button"
                      onClick={handleLogout}
                      className={`${dropdownItemClass} text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10`}
                    >
                      Log out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <Link href="/login" className="nav-link hidden sm:inline-flex">Login</Link>
            </>
          )}

          <ThemeToggle />

          {/* Mobile account/menu affordance keeps primary links reachable on small
              screens without a full drawer build-out. */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label="Toggle navigation menu"
            className="theme-toggle rounded-full border px-3 py-2 text-xs font-medium md:hidden"
          >
            ☰
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="border-t border-slate-200 bg-white/95 dark:border-white/10 dark:bg-slate-950/95 md:hidden">
          <div className="container-padded flex flex-col gap-1 py-3">
            <SearchBox
              className="mb-2"
              inputClassName="field-input !pl-9"
              panelClassName="left-0 right-0 w-auto"
              onNavigate={() => setMenuOpen(false)}
            />
            <Link href="/" onClick={() => setMenuOpen(false)} className="nav-link">Home</Link>
            <Link href="/library" onClick={() => setMenuOpen(false)} className="nav-link">Browse</Link>

            {loaded && user ? (
              <div className="mt-1 space-y-1 border-t border-slate-200 pt-3 dark:border-white/10">
                <div className="flex items-center gap-3 px-1 pb-2">
                  <Avatar user={user} className="h-10 w-10 text-sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {displayName}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {user.name ? `@${user.name}` : user.email}
                    </p>
                  </div>
                </div>
                <Link href="/account" onClick={() => setMenuOpen(false)} className="nav-link">
                  My profile
                </Link>
                <Link href="/my-library" onClick={() => setMenuOpen(false)} className="nav-link">
                  Bookmarks
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="nav-link w-full text-left"
                >
                  Log out
                </button>
              </div>
            ) : loaded ? (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)} className="nav-link">Login</Link>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
