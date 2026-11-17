
import ImageStreamHero from '../components/ImageStreamHero';
import CategorySection from '../components/CategorySection';
import { listSeriesViews } from '../lib/content';
import { getCurrentUser } from '../lib/auth';
import { listLibraryEntries } from '../lib/library';
import { toSeriesCardDataList } from '../lib/series-card';
import type { SeriesCardData } from '../lib/series-card';
import {
  pickHotUpdates,
  pickLatestUpdates,
  pickPopular,
  pickTrending,
  pickUpdatesForYou,
} from '../lib/recommendations';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Yoru',
  description:
    'Explore standout fantasy series, track the latest chapters, and jump back into your bookmarks with a cleaner, more cinematic reader.',
};

/** How many cards each home rail shows before the horizontal scroll runs out. */
const RAIL_LIMIT = 14;
const LIBRARY_VIEW_ALL = '/library';

interface Rail {
  pill: string;
  title: string;
  description?: string;
  series: SeriesCardData[];
  emptyMessage?: string;
  /** Defaults to the full catalog; personal rails point at /my-library. */
  viewAllHref?: string;
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const series = await listSeriesViews();

  const covers = series.map((s) => ({ src: s.cover, alt: s.title }));
  const totalChapters = series.reduce((sum, item) => sum + item.chapters.length, 0);
  const genres = new Set(series.flatMap((item) => item.tags)).size;

  // Personalised rails need the user's library; anonymous visitors skip that
  // query entirely. The entries (not just their series) are kept because the
  // "Updates for you" rail drops anything the reader already completed.
  const libraryEntries = user ? await listLibraryEntries(user.id) : [];
  const librarySeries = libraryEntries.map((entry) => entry.series);

  // Hot Updates can legitimately be empty (nothing new in the window), so it
  // falls back to the freshest activity rather than rendering a blank rail.
  const hot = pickHotUpdates(series, RAIL_LIMIT);
  const hotSeries = hot.length ? hot : pickLatestUpdates(series, RAIL_LIMIT);

  const rails: Rail[] = user
    ? [
        {
          pill: 'For you',
          title: 'Updates for you',
          description:
            'Fresh chapters from the series in your bookmarks, newest first — completed titles stay off this rail.',
          series: pickUpdatesForYou(libraryEntries, RAIL_LIMIT),
          emptyMessage:
            'No fresh chapters from your bookmarks',
          viewAllHref: '/my-library',
        },
        {
          pill: 'Saved',
          title: 'Bookmarks',
          description: 'Everything you filed, with its reading status.',
          series: toSeriesCardDataList(librarySeries),
          emptyMessage: 'Your bookmarks are empty — add a series from its page to get started.',
          viewAllHref: '/my-library',
        },
        {
          pill: 'Trending',
          title: 'Hot Updates',
          description: 'The titles publishing the most chapters right now.',
          series: hotSeries,
        },
        {
          pill: 'New chapters',
          title: 'Recently Updated',
          series: pickLatestUpdates(series, RAIL_LIMIT),
        },
        {
          pill: 'All time',
          title: 'Popular',
          description: 'The deepest catalogs on Yoru.',
          series: pickPopular(series, RAIL_LIMIT),
        },
      ]
    : [
        {
          pill: 'Hot right now',
          title: 'Trending Comics',
          description: 'Standout series our readers keep coming back to.',
          series: pickTrending(series, RAIL_LIMIT),
        },
        {
          pill: 'Fan favorites',
          title: 'Popular',
          description: 'The biggest, most-covered series in the catalog.',
          series: pickPopular(series, RAIL_LIMIT),
        },
        {
          pill: 'Just dropped',
          title: 'Latest Updates',
          description: 'The newest chapters across everything we track.',
          series: pickLatestUpdates(series, RAIL_LIMIT),
        },
      ];


  return (
    <div className="space-y-12 pb-8">
      <section className="hero-panel overflow-hidden">
        <ImageStreamHero
          images={covers}
          className="relative h-[560px] w-full sm:h-[620px] lg:h-[680px]"
        >
          {/* Scrim so the headline and stats stay legible over the covers. */}
          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-white/85 via-white/25 to-white/85 dark:from-slate-950/85 dark:via-slate-950/25 dark:to-slate-950/85" />
          <div className="relative z-20 flex h-full flex-col justify-center px-6 py-10 sm:px-8 lg:px-10 lg:py-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-4">
                <span className="section-pill">Yoru</span>
                <h1 className="text-4xl font-semibold leading-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
                  A sharper home for manhwa, manhua, and manga — and your next binge read.
                </h1>
                <p className="max-w-xl text-sm leading-7 text-slate-700 dark:text-slate-300 sm:text-base">
                  Explore standout Korean manhwa, Chinese manhua, and Japanese manga — track the latest chapters and jump back into your bookmarks with a cleaner, more cinematic interface.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                <div className="stat-card">
                  <span className="stat-value">{series.length}</span>
                  <span className="stat-label">Series queued</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{totalChapters}</span>
                  <span className="stat-label">Chapters ready</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{genres}</span>
                  <span className="stat-label">Genres featured</span>
                </div>
              </div>
            </div>
          </div>
        </ImageStreamHero>
      </section>

      {rails.map((rail) => (
        <CategorySection
          key={rail.title}
          pill={rail.pill}
          title={rail.title}
          description={rail.description}
          series={rail.series}
          viewAllHref={rail.viewAllHref ?? LIBRARY_VIEW_ALL}
          emptyMessage={rail.emptyMessage}
        />
      ))}
    </div>
  );
}

