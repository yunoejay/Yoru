import Link from 'next/link';

const year = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/60">
      <div className="container-padded grid gap-10 py-12 text-sm text-slate-600 dark:text-slate-400 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="" aria-hidden="true" className="h-9 w-9" />
            <span className="text-base font-semibold text-slate-900 dark:text-white">Yoru</span>
          </div>
          <p className="max-w-md leading-7">
            A cleaner home for manhwa (Korean), manhua (Chinese), and manga (Japanese) — fast
            discovery, per-chapter scanlator credit, and a vertical-scroll webtoon reader built
            for getting lost in a series.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-500">Explore</p>
          <ul className="space-y-2">
            <li><Link href="/" className="transition hover:text-brand dark:hover:text-white">Home</Link></li>
            <li><Link href="/library" className="transition hover:text-brand dark:hover:text-white">Browse</Link></li>
            <li><Link href="/register" className="transition hover:text-brand dark:hover:text-white">Create an account</Link></li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Legal</p>
          <ul className="space-y-2">
            <li><Link href="/terms" className="transition hover:text-brand dark:hover:text-white">Terms of service</Link></li>
            <li><Link href="/privacy" className="transition hover:text-brand dark:hover:text-white">Privacy policy</Link></li>
            <li><Link href="/dmca" className="transition hover:text-brand dark:hover:text-white">Takedown requests</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-white/5">
        <div className="container-padded flex flex-col gap-2 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Yoru. An independent project, not affiliated with any publisher or scanlation group.</p>
          <p>Chapter content belongs to its original creators and is credited in the reader.</p>
        </div>
      </div>
    </footer>
  );
}

