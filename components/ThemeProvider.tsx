'use client';

import { useEffect, type ReactNode } from 'react';
import { syncUser } from '@/lib/theme-store';
import { useSessionUser } from './useSessionUser';

/**
 * Keeps the theme in sync with the session.
 *
 * The palette itself is applied by `lib/theme-store.ts` (and already applied
 * before first paint by the bootstrap script in the root layout). This wrapper
 * only tells the store who is signed in:
 * - signed in → that reader's saved theme
 * - signed out → Yoru Dark (themes are a signed-in feature)
 */
export default function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, loaded } = useSessionUser();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!loaded) return;
    syncUser(userId);
  }, [loaded, userId]);

  return <>{children}</>;
}
