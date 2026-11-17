import { findResolvableChapter, getSeriesView, type ChapterView } from '../../../../lib/content';
import { getCurrentUser } from '../../../../lib/auth';
import { listReadChapterNumbers } from '../../../../lib/read-progress';
import Reader from '../../../../components/Reader';
import Link from 'next/link';
import type { ChapterRef } from '../../../../components/ReaderControls';

interface Props {
  params: Promise<{ seriesId: string; chapterId: string }>;
}

type ChapterListItem = { id: string; number: number; title?: string };

function toRef(chapter: ChapterListItem | undefined): ChapterRef | null {
  if (!chapter) return null;
  return { id: chapter.id, number: chapter.number, title: chapter.title ?? null };
}

export default async function ReaderPage({ params }: Props) {
  const { seriesId, chapterId } = await params;
  const user = await getCurrentUser();
  // The collapsed reading order is automatic: the most complete scanlator first,
  // switching to whichever group is ahead for the chapters it has not published.
  let series = await getSeriesView(seriesId);
  // lib/content.ts orders chapters by number ascending, so list order already
  // is reading order - that is what makes "next" mean "next chapter".
  let chapters = series?.chapters ?? [];
  let position = chapters.findIndex(chapter => chapter.id === chapterId);

  // A direct link can point at a Chapter row the collapsed reading order does
  // not include (another scanlator's upload of the same number). Rebuild the
  // view around that chapter's own group so the link
  // opens the right chapter and Prev/Next walk that group's run.
  let resolvedDirectly: Awaited<ReturnType<typeof findResolvableChapter>> = null;
  if (series && position < 0) {
    resolvedDirectly = await findResolvableChapter(chapterId);
    const groupName = resolvedDirectly?.chapter?.groupName ?? null;
    if (groupName) {
      const retry = await getSeriesView(seriesId, { scanlator: groupName });
      const retryPosition = retry
        ? retry.chapters.findIndex(chapter => chapter.id === chapterId)
        : -1;
      if (retry && retryPosition >= 0) {
        series = retry;
        chapters = retry.chapters;
        position = retryPosition;
      }
    }
  }

  if (!series || (position < 0 && !resolvedDirectly)) {
    return (
      <div className="info-card mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <span className="text-4xl" aria-hidden>
          🧭
        </span>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Chapter not found</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          We couldn&rsquo;t find that chapter. It may have moved or been removed.
        </p>
        <Link href="/library" className="btn-primary">Back to library</Link>
      </div>
    );
  }

  // Last resort: a row that is in no reading order (for example a scanlator
  // whose version is a publisher link-out while another group hosts the pages).
  // Render it straight from the resolved row rather than 404-ing a real link.
  const directChapter: ChapterView | null =
    position < 0 && resolvedDirectly
      ? {
          id: chapterId,
          number: resolvedDirectly.chapter?.number ?? 0,
          title: resolvedDirectly.chapter?.title ?? undefined,
          pages: [],
          updatedAt: resolvedDirectly.chapter?.publishedAt ?? new Date().toISOString(),
          sourceId: resolvedDirectly.sourceId,
          externalId: resolvedDirectly.chapter?.externalId ?? null,
          listingId: null,
          groupName: resolvedDirectly.chapter?.groupName ?? null,
          groupId: resolvedDirectly.chapter?.groupId ?? null,
          isOfficial: resolvedDirectly.chapter?.official ?? false,
          pageCount: resolvedDirectly.chapter?.pageCount ?? 0,
          linkOutUrl: resolvedDirectly.chapter?.externalUrl ?? null,
          publishedAt: resolvedDirectly.chapter?.publishedAt ?? new Date().toISOString(),
        }
      : null;

  const chapter: ChapterView = directChapter ?? chapters[position]!;
  // Real (DB) chapters resolve through the proxy at read time; bundled demo
  // chapters already carry their own placeholder images.
  const demoPages = chapter.sourceId
    ? []
    : directChapter
      ? resolvedDirectly?.inlinePages ?? []
      : chapter.pages.map(p => p.image);
  const heading = `${series.title} — Chapter ${chapter.number}${chapter.title ? `: ${chapter.title}` : ''}`;

  const isSignedIn = Boolean(user);
  const initialReadNumbers = user ? await listReadChapterNumbers(user.id, series.id) : [];

  return (
    <Reader
      key={chapter.id}
      chapterId={chapter.id}
      seriesId={series.id}
      seriesTitle={series.title}
      heading={heading}
      demoPages={demoPages}
      creditGroup={chapter.groupName}
      chapterNumber={chapter.number}
      isSignedIn={isSignedIn}
      initialReadNumbers={initialReadNumbers}
      prevChapter={toRef(chapters[position - 1])}
      nextChapter={toRef(chapters[position + 1])}
    />
  );
}


