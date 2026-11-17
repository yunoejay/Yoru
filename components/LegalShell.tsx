import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Shared frame for the public legal pages (Terms, Privacy, DMCA). Kept honest:
 * these are starter texts, not legal advice, and the note below says so.
 */
export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-10">
      <div className="page-intro">
        <p className="section-pill">Legal</p>
        <h1 className="page-title">{title}</h1>
        {updated ? <p className="text-sm text-slate-500 dark:text-slate-400">Last updated: {updated}</p> : null}
      </div>

      <article className="info-card space-y-5 text-sm leading-7 text-slate-700 dark:text-slate-300">
        {children}
      </article>


      <div className="alert alert-info">
        These pages are provided as a starting point and are not legal advice. Replace them with
        terms that match your jurisdiction, hosting, and the content sources you enable before
        going public.
      </div>

      <p className="text-sm">
        <Link href="/" className="font-medium text-brand hover:underline dark:text-brand-accent">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}

