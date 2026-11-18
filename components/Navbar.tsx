"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SearchBox from "./SearchBox";
import ThemeSection from "./ThemeMenu";
import { notifyAuthChanged, useSessionUser, type SessionUser } from "./useSessionUser";
import { resetThemePreference } from "@/lib/theme-store";
import { profileDisplayName } from "@/lib/profile";

const avatarFallbackClass =
  "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-accent font-bold text-white";

const dropdownItemClass =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10";

function BookmarksIcon() {
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
      <path d="M6.5 4.5h11a1 1 0 0 1 1 1v14l-6.5-4-6.5 4v-14a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

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
    // Guests always use Yoru Dark; reset immediately instead of waiting for the
    // provider's next session check.
    resetThemePreference();
    // Tell the shared session hook to drop the user, so the navbar swaps back
    // to the Login link immediately instead of on the next reload.
    notifyAuthChanged();
    router.replace('/');
    router.refresh();
  }

  const displayName = user ? profileDisplayName(user) : '';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70">
      {/* Three columns from `md` up: brand + primary links, the search field in
          the middle, then the account actions. The two outer columns are equal
          `minmax(0,1fr)` tracks, so the search stays centred even when only one
          side has content to show. Below `md` it stays a flex row and the
          mobile menu carries its own copy of the search box. */}
      <div className="container-padded flex h-16 items-center justify-between gap-4 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-2 md:gap-4">
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
        </div>

        {/* Header search with live suggestions from /api/search. Hidden on
            small screens; the mobile menu below carries its own copy. The
            suggestions panel is centred under the field to match. */}
        <SearchBox
          className="hidden md:block md:w-48 lg:w-72 xl:w-80"
          inputClassName="field-input h-10 !pl-9"
          panelClassName="left-1/2 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2"
        />

        <div className="flex items-center justify-end gap-2">

          {/* While the session is loading, render a neutral placeholder rather
              than the Login link: showing it to a signed-in reader was the
              "button is still there after login" bug. */}
          {!loaded ? (
            <span
              className="hidden h-9 w-16 animate-pulse rounded-full bg-slate-200 sm:block dark:bg-white/10"
              aria-hidden
            />
          ) : user ? (
            <>
              {/* Bookmarks sits beside the avatar, on its left, instead of
                  inside the profile dropdown. The label hides on the narrower
                  breakpoints where the row would crowd the centred search, and
                  the icon keeps an accessible name. */}
              <Link
                href="/my-library"
                title="Bookmarks"
                aria-label="Bookmarks"
                className="nav-link inline-flex items-center gap-2"
              >
                <BookmarksIcon />
                <span className="hidden lg:inline">Bookmarks</span>
              </Link>
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
                  <span className="hidden max-w-[9rem] truncate text-xs font-medium xl:inline">
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
                    className="absolute right-0 z-50 mt-2 max-h-[calc(100vh-6rem)] w-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40 md:max-h-none md:overflow-visible"
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
                      <ThemeSection />
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
            </>
          ) : (
            <>
              <Link href="/login" className="nav-link hidden sm:inline-flex">Login</Link>
            </>
          )}

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
                  <Link
                    href="/my-library"
                    onClick={() => setMenuOpen(false)}
                    title="Bookmarks"
                    aria-label="Bookmarks"
                    className="nav-link inline-flex shrink-0 items-center gap-2"
                  >
                    <BookmarksIcon />
                    <span className="hidden sm:inline">Bookmarks</span>
                  </Link>
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
                <ThemeSection variant="inline" />
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
