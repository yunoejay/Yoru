'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Shared frame for every auth-style page (login, register, verify, forgot,
 * reset) so they all present the same branded, centered card with a glow,
 * instead of each page hand-rolling a bare gray box.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-[70vh] items-center justify-center py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_45%)]" aria-hidden />

      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="mx-auto flex w-fit items-center gap-3 text-slate-900 dark:text-white">
          <img src="/icon.svg" alt="" aria-hidden="true" className="h-10 w-10" />
          <span>
            <span className="block text-xs font-semibold tracking-[0.28em] text-slate-500 dark:text-slate-400">YORU</span>
          </span>
        </Link>

        <div className="card-surface space-y-6 p-7">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h1>
            {subtitle ? (
              <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">{subtitle}</p>
            ) : null}
          </div>

          {children}

          {footer ? <div className="space-y-2 border-t border-slate-200 pt-5 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
            {footer}
          </div> : null}
        </div>
      </div>
    </div>
  );
}
