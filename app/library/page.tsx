import PageHeader from '../../components/PageHeader';
import SeriesBrowser from '../../components/SeriesBrowser';
import { listSeriesViews } from '../../lib/content';
import { toSeriesCardDataList } from '../../lib/series-card';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Browse Series',
  description: 'Browse every manhwa, manhua, and manga on Yoru — search by title, author, or genre and sort the full catalog.',
};

interface Props {
  searchParams: Promise<{ q?: string }>;
}

/** Demo-data banner is a dev affordance - hidden in public production builds. */
const showDemoNotice = process.env.NODE_ENV !== 'production';

export default async function LibraryPage({ searchParams }: Props) {
  const [{ q }, series] = await Promise.all([searchParams, listSeriesViews()]);
  const cards = toSeriesCardDataList(series);
  const initialQuery = (q ?? '').trim();

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        pill="Browse Series"
        title="The whole shelf, in one place."
        description="Search every manhwa, manhua, or manga by title, author, or genre, then sort the catalog your way."
      />

      {showDemoNotice && series[0]?.isStaticDemo ? (
        <p className="alert alert-info max-w-2xl">
          Showing bundled demo data — apply the Prisma migration and run an import to serve real chapters.
        </p>
      ) : null}

      <SeriesBrowser
        // A navbar search can change ?q= while this page is already mounted.
        // Remounting on the query makes the browser pick up the new seed
        // instead of keeping the old `useState(initialQuery)` value.
        key={initialQuery}
        series={cards}
        initialQuery={initialQuery}
        emptyHint="No series match your search yet. Clear the filters or try a broader term."
      />
    </div>
  );
}

