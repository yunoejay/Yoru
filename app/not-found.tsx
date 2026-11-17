import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="info-card mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="text-5xl" aria-hidden>
        🌀
      </span>
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Page not found</h1>
      <p className="max-w-sm text-sm leading-7 text-slate-500 dark:text-slate-400">
        The page you were looking for doesn&rsquo;t exist or may have moved.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-1">
        <Link href="/" className="btn-primary">
          Go home
        </Link>
        <Link href="/library" className="btn-ghost">
          Browse library
        </Link>
      </div>
    </div>
  );
}
