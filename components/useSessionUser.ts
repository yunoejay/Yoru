'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { PublicProfile } from '@/lib/profile';

/**
 * The signed-in reader, shared by the Navbar and anywhere else that needs to
 * react to login/logout/profile edits.
 *
 * The Navbar lives in the root layout, so it is NOT remounted when the route
 * changes. Fetching once on mount is what left the Login button on screen
 * after a successful login. This hook refetches on every pathname change
 * and on the `yoru:auth-changed` event, which login, logout and profile saves
 * dispatch.
 */

export const AUTH_CHANGED_EVENT = 'yoru:auth-changed';

export type SessionUser = PublicProfile;

/**
 * The navbar and the theme provider both ask for the session on mount. Sharing
 * the in-flight request keeps that to a single `/api/auth/me` call instead of
 * two.
 */
let inflight: Promise<SessionUser | null> | null = null;

function requestUser(): Promise<SessionUser | null> {
  if (!inflight) {
    inflight = fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => res.json() as Promise<{ user?: SessionUser | null }>)
      .then((data) => data.user ?? null)
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

export function notifyAuthChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function useSessionUser(): {
  user: SessionUser | null;
  loaded: boolean;
  refresh: () => Promise<void>;
} {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const next = await requestUser();
    setUser(next);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(AUTH_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onChange);
  }, [refresh]);

  return { user, loaded, refresh };
}
