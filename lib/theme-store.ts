'use client';

/**
 * The single source of truth for the active theme on the client.
 *
 * Themes are a signed-in feature: guests always get Yoru Dark. The store is
 * therefore driven by `syncUser()` — `ThemeProvider` calls it whenever the
 * session resolves or changes.
 *
 * State lives in an external store (read through `useSyncExternalStore`) rather
 * than in React state so the pre-paint bootstrap script, the picker and the
 * provider can all apply/serialize the same value without setState-in-effect
 * cascades.
 */

import {
  DEFAULT_THEME_ID,
  SYSTEM_PREFERENCE,
  THEME_COOKIE_NAME,
  isThemeId,
  resolveThemePreference,
  type Theme,
} from './themes';

/** localStorage key prefix; the suffix is the signed-in reader's id. */
export const THEME_STORAGE_PREFIX = 'yoru:theme:';

/** Key used by the old two-state (light/dark) toggle, migrated once. */
const LEGACY_STORAGE_KEY = 'theme';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type Listener = () => void;

const listeners = new Set<Listener>();

/** `null` until the session is known; then a theme id or `system`. */
let preference: string | null = null;
let userId: string | null = null;
let globalsBound = false;

export function prefersDarkMode(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function isPreference(value: string): boolean {
  return value === SYSTEM_PREFERENCE || isThemeId(value);
}

function emit(): void {
  for (const listener of listeners) listener();
}

/** Snapshot for the browser. */
export function getPreference(): string {
  return preference ?? DEFAULT_THEME_ID;
}

/** Snapshot used during hydration so the server and client agree. */
export function getServerPreference(): string {
  return DEFAULT_THEME_ID;
}

export function getActiveTheme(): Theme {
  return resolveThemePreference(getPreference(), prefersDarkMode());
}

/**
 * The non-httpOnly cookie mirrors the active theme for the blocking script in
 * `<head>`. It is only written for signed-in readers, so guests — and a stale
 * cookie left behind by a logout in another tab — fall back to Yoru Dark.
 */
function writeHint(next: string | null): void {
  if (typeof document === 'undefined') return;

  if (!userId || next === null) {
    document.cookie = `${THEME_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }

  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(next)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function applyPreference(): Theme {
  const theme = getActiveTheme();

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.dataset.theme = theme.id;
    root.classList.toggle('dark', theme.mode === 'dark');
    root.style.colorScheme = theme.mode;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme.palette.bg);
  }

  return theme;
}

function persist(next: string): void {
  if (typeof window === 'undefined' || !userId) return;

  try {
    window.localStorage.setItem(THEME_STORAGE_PREFIX + userId, next);
  } catch {
    // Storage can be unavailable (private mode, quota). The theme still applies
    // for this tab; it just will not survive a reload.
  }
}

function readStored(nextUserId: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const value = window.localStorage.getItem(THEME_STORAGE_PREFIX + nextUserId);
    return value && isPreference(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * One-time migration from the old `theme` key: readers who had picked light
 * mode keep a light theme instead of being dropped back to Yoru Dark.
 */
function migrateLegacyPreference(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return null;

    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    if (legacy === 'light') return 'yoru-light';
    if (legacy === 'dark') return DEFAULT_THEME_ID;
  } catch {
    // Ignore unreadable storage.
  }

  return null;
}

/** Persist and apply a new choice. Guests cannot change the theme. */
export function setPreference(next: string): void {
  if (!userId || !isPreference(next) || next === preference) return;

  preference = next;
  persist(next);
  writeHint(next);
  applyPreference();
  emit();
}

/** Reset the applied theme to Yoru Dark without forgetting the stored choice. */
export function resetThemePreference(): void {
  preference = DEFAULT_THEME_ID;
  writeHint(null);
  applyPreference();
  emit();
}

/**
 * Called by `ThemeProvider` when the session resolves:
 * - signed in → load that reader's stored preference (migrating the legacy key)
 * - signed out → force Yoru Dark, as agreed for guests
 */
export function syncUser(nextUserId: string | null): void {
  if (nextUserId === userId && preference !== null) {
    if (nextUserId) writeHint(preference);
    return;
  }

  userId = nextUserId;

  if (!nextUserId) {
    preference = DEFAULT_THEME_ID;
    writeHint(null);
    applyPreference();
    emit();
    return;
  }

  const stored = readStored(nextUserId);
  const next = stored ?? migrateLegacyPreference() ?? DEFAULT_THEME_ID;

  preference = next;
  persist(next);
  writeHint(next);
  applyPreference();
  emit();
}

function bindGlobalListeners(): void {
  if (globalsBound || typeof window === 'undefined') return;
  globalsBound = true;

  // Another tab changed the preference for the signed-in reader.
  window.addEventListener('storage', (event) => {
    if (!event.key || !event.key.startsWith(THEME_STORAGE_PREFIX)) return;
    if (!userId || event.key !== THEME_STORAGE_PREFIX + userId) return;

    const next = event.newValue;
    if (!next || !isPreference(next) || next === preference) return;

    preference = next;
    applyPreference();
    emit();
  });

  // 'Follow system' has to react to the OS switching between light and dark.
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener?.('change', () => {
    if (getPreference() !== SYSTEM_PREFERENCE) return;
    applyPreference();
    emit();
  });
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  bindGlobalListeners();

  return () => {
    listeners.delete(listener);
  };
}
