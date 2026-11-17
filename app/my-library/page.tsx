import type { Metadata } from 'next';
import Link from 'next/link';
import PageHeader from '../../components/PageHeader';
import MyLibraryBrowser from '../../components/MyLibraryBrowser';
import { getCurrentUser } from '@/lib/auth';
import { listLibraryEntries } from '@/lib/library';
import { toSeriesCardData } from '@/lib/series-card';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Bookmarks',
  description:
    'Every series you have filed, with its reading status — reading, rereading, plan to read, completed, on hold or dropped.',
};

export default async function MyLibraryPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="info-card mx-auto max-w-md space-y-3 py-10 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Log in to keep personal bookmarks and track each series&rsquo; reading status.
        </p>
        <Link href="/login" className="btn-primary">
          Go to login
        </Link>
      </div>
    );
  }

  const entries = await listLibraryEntries(user.id);
  const items = entries.map(entry => ({
    status: entry.status,
    addedAt: entry.addedAt,
    series: toSeriesCardData(entry.series),
  }));

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        pill="Bookmarks"
        title="Your shelf, sorted by status."
        description="Series you are reading, planning to read, or have finished — change a status or remove a title any time."
      />
      <MyLibraryBrowser items={items} />
    </div>
  );
}
