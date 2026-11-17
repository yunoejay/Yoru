/**
 * Atsumaru (MangaBaka) import CLI.
 *
 * A *sanctioned API* source (not a scraper): it talks to the public MangaBaka
 * JSON API that atsu.moe is built on, and pages are served from cdn.atsu.moe
 * rather than the slow, rate-limited MangaDex@Home nodes. It is enabled unless
 * `ATSUMARU_ENABLED=false` is set in .env.local. importSeriesFromSource throws
 * if the source is disabled.
 *
 * Usage:
 *   npx tsx scripts/import-atsumaru.ts "Series Title"
 *       Search Atsumaru and print the top matches with their manga ids.
 *
 *   npx tsx scripts/import-atsumaru.ts --id <mangaId>
 *       Show a title's metadata + chapter list WITHOUT touching the database.
 *
 *   npx tsx scripts/import-atsumaru.ts "Series Title" --db
 *       Import the #1 search hit into Postgres (needs DATABASE_URL + migration).
 *
 *   npx tsx scripts/import-atsumaru.ts --id <mangaId> --db --limit 25
 *       Cap the import for a smoke test.
 *
 *   npx tsx scripts/import-atsumaru.ts --id <mangaId> --db --incremental
 *       Only import chapters above the stored lastChapterNumber cursor.
 *
 * Page URLs are never printed or stored: they are re-resolved at read time by
 * /api/chapter/[chapterId]/pages, exactly like MangaDex chapters.
 */

import prisma from '../lib/prisma';
import { atsumaruSource } from '../lib/sources/atsumaru';
import { importSeriesFromSource } from '../lib/sync';

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const query = args.find(arg => !arg.startsWith('--') && args[args.indexOf(arg) - 1] !== '--id');
  const idFlag = flagValue(args, '--id');
  const toDb = args.includes('--db');
  const incremental = args.includes('--incremental');
  const limitValue = flagValue(args, '--limit');
  const chapterLimit = limitValue ? Number(limitValue) : undefined;

  if (!atsumaruSource.enabled) {
    console.error('The Atsumaru source is disabled. Remove ATSUMARU_ENABLED=false from .env.local.');
    process.exit(1);
  }

  if (!idFlag && !query) {
    console.error('Provide a title or --id <mangaId>. See the header comment.');
    process.exit(1);
  }

  let externalId = idFlag;
  if (!externalId) {
    console.log(`Searching Atsumaru for "${query}"...\n`);
    const results = await atsumaruSource.search(query!);
    if (!results.length) {
      console.error('No results. Try a different spelling.');
      process.exit(1);
    }
    results.slice(0, 10).forEach((hit, i) => {
      console.log(`${i + 1}. ${hit.title}\n   id: ${hit.externalId}`);
    });
    externalId = results[0].externalId;
    console.log(`\nUsing #1: ${results[0].title} (${externalId})\n`);
  }

  if (toDb) {
    let sinceChapterNumber: number | undefined;
    if (incremental) {
      const source = await prisma.source.findUnique({ where: { slug: 'atsumaru' } });
      const listing = source
        ? await prisma.seriesListing.findUnique({
            where: { sourceId_externalId: { sourceId: source.id, externalId: externalId! } },
          })
        : null;
      sinceChapterNumber = listing?.lastChapterNumber ?? undefined;
      console.log(
        sinceChapterNumber
          ? `Incremental: importing only chapters above ${sinceChapterNumber}`
          : 'Incremental: no cursor yet, importing everything'
      );
    }

    const result = await importSeriesFromSource({
      sourceId: 'atsumaru',
      externalId: externalId!,
      chapterLimit,
      sinceChapterNumber,
    });

    console.log(`\nImported "${result.title}" from Atsumaru (MangaBaka API)`);
    console.log(`  series id:   ${result.seriesId}`);
    console.log(`  listing id:  ${result.listingId}`);
    console.log(`  chapters:    ${result.chaptersWritten} written (${result.newChapters} new)`);
    console.log(`  scanlators:  ${result.scanlators.join(', ') || 'unknown'}`);
    console.log(`\nRead it at:  /series/${result.seriesId}`);
    return;
  }

  const [meta, chapters] = await Promise.all([
    atsumaruSource.getSeries(externalId!),
    atsumaruSource.getChapters(externalId!, { limit: chapterLimit ?? 25 }),
  ]);

  if (!meta) {
    console.error('Series not found on Atsumaru.');
    process.exit(1);
  }

  console.log(`${meta.title}${meta.author ? ` by ${meta.author}` : ''} [${meta.status}]`);
  console.log(`cover: ${meta.cover}`);
  console.log(`tags:  ${meta.tags.join(', ') || 'none'}\n`);

  const readable = chapters.filter(c => c.pageCount > 0).length;
  console.log(`Chapters: ${chapters.length} (with known page count: ${readable})\n`);
  console.log('First chapters:');
  for (const chapter of chapters.slice(0, 10)) {
    console.log(
      `  ch ${String(chapter.number).padEnd(6)} ${chapter.title}  ${chapter.pageCount}p  ${chapter.groupName ?? 'unknown'}  ${chapter.publishedAt.slice(0, 10)}`
    );
  }
  console.log(
    '\nPage URLs are intentionally NOT printed. Resolve at read time with\n' +
      'GET /api/chapter/<id>/pages after importing with --db.\n'
  );
}

main()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
