/**
 * Import/sync of source data into the database.
 *
 * Only identity + metadata is written, never page URLs (they expire in ~15
 * minutes for MangaDex). Re-running a sync is cheap and incremental: the
 * `lastChapterNumber` cursor records how far we got, so a later run can pick up
 * new chapters without re-importing the whole title.
 */

import prisma from './prisma';
import { getSource } from './sources';
import type { ScanlationSource, SourceChapter } from './sources/types';

export interface ImportResult {
  seriesId: string;
  listingId: string;
  title: string;
  chaptersWritten: number;
  newChapters: number;
  scanlators: string[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

/** Make sure a Source row exists for an adapter so listings can point at it. */
export async function ensureSource(source: ScanlationSource) {
  return prisma.source.upsert({
    where: { slug: source.id },
    update: { label: source.label, isLegal: source.legal },
    create: { slug: source.id, label: source.label, isLegal: source.legal },
  });
}

export interface ImportOptions {
  sourceId: string;
  externalId: string;
  /** Cap chapters for quick tests; omit for a full import. */
  chapterLimit?: number;
  /** Attach to an existing series row instead of creating one. */
  targetSeriesId?: string;
  /** Only import chapters above this number (incremental). */
  sinceChapterNumber?: number;
  languages?: string[];
  /** Restrict to specific upstream scanlation group IDs. */
  groupIds?: string[];
  /**
   * When attaching to a series that already exists, pass `false` to add the
   * listing + chapters WITHOUT rewriting that series' title/cover/synopsis/
   * tags/author from the incoming source. Used when the same work is imported
   * from a second source just to gain its scanlators: the extra chapters should
   * not turn the series into the other source's edition. Defaults to true.
   */
  overwriteSeriesMeta?: boolean;
}

export async function importSeriesFromSource(options: ImportOptions): Promise<ImportResult> {
  const source = getSource(options.sourceId);
  if (!source) throw new Error(`Unknown source "${options.sourceId}"`);
  if (!source.enabled) {
    throw new Error(
      `Source "${source.id}" is disabled (${source.legal ? 'flag it on' : 'scraper - requires legal acknowledgement'}).`
    );
  }

  const sourceRow = await ensureSource(source);

  const [meta, allChapters] = await Promise.all([
    source.getSeries(options.externalId),
    source.getChapters(options.externalId, {
      languages: options.languages,
      groupIds: options.groupIds,
      limit: options.chapterLimit,
    }),
  ]);

  if (!meta) throw new Error(`Source "${source.id}" has no series "${options.externalId}"`);

  const existingListing = await prisma.seriesListing.findUnique({
    where: { sourceId_externalId: { sourceId: sourceRow.id, externalId: options.externalId } },
  });

  // Resolve or create the series row this listing belongs to.
  let seriesId = options.targetSeriesId ?? existingListing?.seriesId;
  if (seriesId) {
    // Attaching a second source to an existing series to gain its scanlations
    // must not rewrite the series' own identity, so this is opt-out-able.
    if (options.overwriteSeriesMeta !== false) {
      await prisma.series.update({
        where: { id: seriesId },
        data: { title: meta.title, cover: meta.cover, synopsis: meta.description, status: meta.status, tags: meta.tags, extraTags: meta.extraTags ?? [], author: meta.author },
      });
    }
  } else {
    const baseSlug = slugify(meta.title) || `series-${Date.now()}`;
    const taken = await prisma.series.findUnique({ where: { slug: baseSlug } });
    const slug = taken ? `${baseSlug}-${source.id}` : baseSlug;

    const created = await prisma.series.create({
      data: {
        title: meta.title,
        cover: meta.cover,
        synopsis: meta.description,
        status: meta.status,
        tags: meta.tags,
        extraTags: meta.extraTags ?? [],
        author: meta.author,
        slug,
      },
    });
    seriesId = created.id;
  }

  const listing = await prisma.seriesListing.upsert({
    where: { sourceId_externalId: { sourceId: sourceRow.id, externalId: options.externalId } },
    update: {
      seriesId,
      groupName: allChapters[0]?.groupName ?? null,
      isOfficial: allChapters.some(c => c.official),
    },
    create: {
      sourceId: sourceRow.id,
      externalId: options.externalId,
      seriesId,
      groupName: allChapters[0]?.groupName ?? null,
      isOfficial: allChapters.some(c => c.official),
    },
  });

  let chaptersToWrite = allChapters;
  if (options.sinceChapterNumber != null) {
    chaptersToWrite = allChapters.filter(c => c.number > options.sinceChapterNumber!);
  }

  const previousIds = new Set(
    (await prisma.chapter.findMany({ where: { listingId: listing.id }, select: { externalId: true } })).map(
      c => c.externalId
    )
  );

  for (const chapter of chaptersToWrite) {
    await upsertChapter(seriesId, listing.id, source.id, chapter);
  }

  const maxNumber = chaptersToWrite.reduce((max, c) => Math.max(max, c.number), existingListing?.lastChapterNumber ?? 0);

  await prisma.seriesListing.update({
    where: { id: listing.id },
    data: { lastChapterNumber: maxNumber || null, syncedAt: new Date() },
  });

  const scanlators = Array.from(
    new Set(chaptersToWrite.map(c => (c.official ? `${c.groupName} (official)` : c.groupName)).filter(Boolean) as string[])
  );

  return {
    seriesId,
    listingId: listing.id,
    title: meta.title,
    chaptersWritten: chaptersToWrite.length,
    newChapters: chaptersToWrite.filter(c => !previousIds.has(c.externalId)).length,
    scanlators,
  };
}

async function upsertChapter(
  seriesId: string,
  listingId: string,
  _sourceId: string,
  chapter: SourceChapter
): Promise<void> {
  const data = {
    seriesId,
    listingId,
    number: chapter.number,
    volume: chapter.volume ?? null,
    title: chapter.title ?? null,
    groupName: chapter.groupName ?? null,
    groupId: chapter.groupId ?? null,
    isOfficial: Boolean(chapter.official),
    language: chapter.language,
    pageCount: chapter.pageCount,
    externalUrl: chapter.externalUrl ?? null,
    publishedAt: new Date(chapter.publishedAt),
  };

  await prisma.chapter.upsert({
    where: { listingId_externalId: { listingId, externalId: chapter.externalId } },
    update: data,
    create: { externalId: chapter.externalId, ...data },
  });
}
