import { getSeriesView } from '../../../lib/content';
import { getCurrentUser } from '../../../lib/auth';
import { getLibraryEntry } from '../../../lib/library';
import { listReadChapterNumbers } from '../../../lib/read-progress';
import LibraryButton from '../../../components/LibraryButton';
import ExtraTags from '../../../components/ExtraTags';
import ChapterList from '../../../components/ChapterList';
import ContinueReading from '../../../components/ContinueReading';
import { isFormatTag, seriesFormatInfo } from '../../../lib/formats';
import { formatRelativeDate } from '../../../lib/utils';
import Link from 'next/link';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scanlator?: string }>;
}

export const dynamic = 'force-dynamic';

const statusStyles: Record<string, string> = {
  ongoing: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-200',
  completed: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200',
  hiatus: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * A chapter title worth printing next to "CH. N".
 *
 * Sources often repeat the number in the title ("Chapter 162: Collapse"), so the
 * leading "Chapter N" is stripped and an empty remainder means "no title".
 */
function chapterGroupTitle(chapters: { title?: string }[]): string | null {
  const raw = chapters.find(chapter => chapter.title?.trim())?.title?.trim();
  if (!raw) return null;
  const stripped = raw.replace(/^chapter\s+[\d.]+\s*[:.–—-]?\s*/i, '').trim();
  return stripped || null;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const series = await getSeriesView(id);
  if (!series) return { title: 'Series not found' };
  return {
    title: series.title,
    description: series.description.slice(0, 160),
  };
}

export default async function SeriesDetailPage({ params, searchParams }: Props) {
  const [{ id }, { scanlator: requestedScanlator }] = await Promise.all([params, searchParams]);

  const user = await getCurrentUser();
  const isSignedIn = Boolean(user);

  // `?scanlator=` browses ONE group's chapters (the tab strip below). It is a
  // view filter only: the reader and the "Reading order" tab keep the automatic
  // collapsed order.
  const requested = (requestedScanlator ?? '').trim();
  const series = await getSeriesView(id, {
    scanlator: requested || null,
    // The chapter list renders one card per chapter number with a row per
    // scanlator, so it needs the raw uploads (not just the reading order).
    withChapterGroups: true,
  });

  if (!series) {
    return (
      <div className="info-card flex flex-col items-center gap-4 py-16 text-center">
        <span className="text-4xl" aria-hidden>
          📚
        </span>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Series not found</h1>
        <p className="max-w-md text-sm leading-7 text-slate-600 dark:text-slate-300">
          This title may have been removed or the link is incorrect.
        </p>
        <Link href="/library" className="btn-primary mt-2">
          Back to library
        </Link>
      </div>
    );
  }

  const statusClass = statusStyles[series.status] ?? statusStyles.ongoing;

  // Format is the comic tradition, not a genre: manhwa is Korean, manhua is
  // Chinese, manga is Japanese. It gets its own chip so the genre pills do not
  // repeat it (and so a Korean title is never labelled "manga").
  const format = seriesFormatInfo(series.tags);
  const genreTags = series.tags.filter(
    tag => !isFormatTag(tag) && tag.toLowerCase() !== 'aggregator',
  );

  const libraryEntry = user ? await getLibraryEntry(user.id, series.id) : null;

  // Only treat ?scanlator= as active when it names a group that really covers
  // this title; anything else falls back to the reading order.
  const activeScanlator =
    requested && series.scanlators.some(group => group.groupName === requested) ? requested : null;

  // Signed-in readers get their read chapters server-side; guests hydrate the
  // same checkboxes from localStorage in the client components.
  const initialReadNumbers = user ? await listReadChapterNumbers(user.id, series.id) : [];

  // One card per chapter number, one row per scanlator upload. Relative dates are
  // formatted here (server-side) so SSR and hydration agree on every label.
  const chapterGroups = series.chapterGroups.map(group => ({
    number: group.number,
    title: chapterGroupTitle(group.chapters),
    rows: group.chapters.map(chapter => ({
      id: chapter.id,
      groupName: chapter.groupName,
      isOfficial: chapter.isOfficial,
      pageCount: chapter.pageCount,
      linkOutUrl: chapter.linkOutUrl,
      updatedLabel: formatRelativeDate(chapter.publishedAt),
    })),
  }));
  const chapterRefs = series.chapters.map(chapter => ({ id: chapter.id, number: chapter.number }));

  return (
    <div className="space-y-10 pb-10">
      {/* Hero: cover over a soft brand-tinted glow, meta to the side. */}
      <section className="hero-panel relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.20),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.16),transparent_34%)]" />
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[280px_1fr] lg:p-10">
          <div className="relative mx-auto w-full max-w-[280px]">
            <div className="absolute inset-x-6 top-6 h-40 rounded-full bg-brand/30 blur-3xl" aria-hidden />
            <img
              src={series.cover}
              alt={`${series.title} cover`}
              className="relative w-full rounded-[1.5rem] border border-black/10 object-cover shadow-2xl shadow-black/20 dark:border-white/10"
            />
          </div>

          <div className="flex flex-col gap-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`chip ${statusClass}`}>{series.status}</span>
                {format ? (
                  <span className="chip">
                    {format.label} · {format.origin}
                  </span>
                ) : null}
                <span className="chip">{series.chapters.length} chapters</span>
                <span className="chip">Updated {formatDate(series.updatedAt)}</span>
              </div>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
                {series.title}
              </h1>
              {series.author ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">by {series.author}</p>
              ) : null}
            </div>

            <p className="max-w-prose text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
              {series.description}
            </p>

            {genreTags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {genreTags.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}

            {series.extraTags?.length ? (
              <ExtraTags tags={series.extraTags} />
            ) : null}

            {series.scanlatorLabels.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Scanlators</span>
                {series.scanlatorLabels.map((label) => (
                  <span key={label} className="chip-accent">
                    {label}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 pt-1">
              <ContinueReading
                seriesId={series.id}
                chapters={chapterRefs}
                isSignedIn={isSignedIn}
                initialReadNumbers={initialReadNumbers}
              />
              <LibraryButton
                key={series.id}
                seriesId={series.id}
                isSignedIn={isSignedIn}
                initialStatus={libraryEntry?.status ?? null}
              />
              <Link href="/library" className="btn-ghost">
                Back to library
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="space-y-4">
        {series.scanlators.length > 1 ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="filter-label">Scanlations</span>
              {activeScanlator ? (
                <Link
                  href={`/series/${series.id}`}
                  className="text-xs text-slate-500 hover:underline dark:text-slate-400"
                >
                  Show reading order
                </Link>
              ) : null}
            </div>
            <div className="filter-scroll flex gap-2 overflow-x-auto pb-1">
              <Link
                href={`/series/${series.id}`}
                className={`filter-pill ${activeScanlator ? '' : 'filter-pill-active'}`}
                aria-current={activeScanlator ? undefined : 'page'}
              >
                Reading order
              </Link>
              {series.scanlators.map(group => {
                const active = activeScanlator === group.groupName;
                const label = `${group.groupName}${group.official ? ' (official)' : ''}`;
                const detail =
                  group.maxNumber === null ? '' : ` · up to ch. ${group.maxNumber}`;
                return (
                  <Link
                    key={group.groupName}
                    href={`/series/${series.id}?scanlator=${encodeURIComponent(group.groupName)}`}
                    title={`${group.count} chapter${group.count === 1 ? '' : 's'}${detail}`}
                    className={`filter-pill ${active ? 'filter-pill-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {label} · {group.count}
                  </Link>
                );
              })}
            </div>
            <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
              {activeScanlator
                ? `Browsing ${activeScanlator}'s uploads only. Pick Reading order to see every group's release of each chapter.`
                : 'Every group that uploaded a chapter is listed under it. Pick a group to browse only its releases.'}
            </p>
          </div>
        ) : null}

        <ChapterList
          key={activeScanlator ?? 'reading-order'}
          seriesId={series.id}
          groups={chapterGroups}
          isSignedIn={isSignedIn}
          initialReadNumbers={initialReadNumbers}
          activeScanlator={activeScanlator}
        />
      </section>

    </div>
  );
}
