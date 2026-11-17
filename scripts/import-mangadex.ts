/**
 * MangaDex import CLI.
 *
 * Usage:
 *   npx tsx scripts/import-mangadex.ts "Series Title"
 *       Search and print the first match's chapter list with scanlator names.
 *
 *   npx tsx scripts/import-mangadex.ts "Series Title" --db
 *       Import into the database (needs DATABASE_URL + applied migration).
 *
 *   npx tsx scripts/import-mangadex.ts "Series Title" --db --limit 25
 *       Cap the import so you can smoke-test before pulling a whole title.
 *
 *   npx tsx scripts/import-mangadex.ts --id <mangaUuid> --db
 *       Skip search when you already know the MangaDex UUID.
 *
 *   npx tsx scripts/import-mangadex.ts --id <mangaUuid> --groups "Tapas"
 *       Only list chapters from specific scanlators (this is the multi-scan
 *       workflow: MangaDex no longer supports a groups[] feed filter, so the
 *       feed is fetched once and bucketed by group).
 *
 *   npx tsx scripts/import-mangadex.ts --list-groups <mangaUuid>
 *       Which scanlators cover a title, and how many chapters each has.
 *
 *   npx tsx scripts/import-mangadex.ts --find-group "Asura Scans"
 *       Look a scanlator up: shows locked/official and whether they really
 *       carry chapters. This is how you discover that Asura is NOT on MangaDex.
 *
 *   npx tsx scripts/import-mangadex.ts "Title" --db --incremental
 *       Only import chapters above the stored lastChapterNumber cursor.
 *
 * Note there is deliberately no --write flag any more: the old one pasted page
 * URLs into lib/data.ts, and MangaDex at-home URLs expire in ~15 minutes, so
 * those files rotted almost immediately. Import to the DB and let the reader
 * resolve pages at read time via /api/chapter/[chapterId]/pages.
 */

import prisma from '../lib/prisma';
import { mangadexSource, listGroupsForSeries, findGroupByName, countChaptersForGroup } from '../lib/sources/mangadex';
import { importSeriesFromSource } from '../lib/sync';

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function resolveGroupIds(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const matches = await findGroupByName(name.trim());
    const exact = matches.find(m => m.name.toLowerCase() === name.trim().toLowerCase()) || matches[0];
    if (!exact) {
      console.error(`  ! No MangaDex group found for "${name}"`);
      continue;
    }
    console.error(`  = ${exact.name} -> ${exact.id}${exact.locked ? ' (locked)' : ''}${exact.official ? ' (official)' : ''}`);
    ids.push(exact.id);
  }
  return ids;
}

async function main() {
  const args = process.argv.slice(2);
  const query = args.find(arg => !arg.startsWith('--'));
  const explicitId = flagValue(args, '--id');
  const toDb = args.includes('--db');
  const incremental = args.includes('--incremental');
  const limitValue = flagValue(args, '--limit');
  const chapterLimit = limitValue ? Number(limitValue) : undefined;
  const groupsFlag = flagValue(args, '--groups');
  const listGroupsArg = flagValue(args, '--list-groups');
  const findGroupArg = flagValue(args, '--find-group');

  if (findGroupArg) {
    const groups = await findGroupByName(findGroupArg);
    if (!groups.length) {
      console.log(`No MangaDex group matches "${findGroupArg}".`);
      return;
    }
    console.log(`Groups matching "${findGroupArg}":`);
    for (const group of groups) {
      const chapterCount = await countChaptersForGroup(group.id).catch(() => -1);
      console.log(`  ${group.name}`);
      console.log(`    id:        ${group.id}`);
      console.log(`    locked:    ${group.locked}`);
      console.log(`    official:  ${group.official} (licensed publisher group)`);
      console.log(`    chapters:  ${chapterCount < 0 ? 'unknown' : chapterCount}`);
      console.log(
        `    verdict:   ${
          chapterCount === 0
            ? 'NOT readable via MangaDex - import their feed directly or use the official publisher'
            : group.official
              ? 'official/licensed chapters, safe to read'
              : 'fan scanlation, readable but attribute and honour removal requests'
        }`
      );
    }
    console.log('\nTo page through a group\'s chapters across all titles use:');
    console.log('  GET https://api.mangadex.org/chapter?groups[]=<uuid>&limit=100\n');
    return;
  }

  if (listGroupsArg) {
    const groups = await listGroupsForSeries(listGroupsArg);
    console.log(`Scanlators covering ${listGroupsArg}:`);
    if (!groups.length) console.log('  (none in English - try another language or title)');
    for (const group of groups) {
      console.log(`  ${String(group.chapters).padStart(4)}  ${group.groupName}${group.official ? '  [official]' : ''}`);
    }
    return;
  }

  let externalId = explicitId;

  if (!externalId) {
    if (!query) {
      console.error('Provide a title, --id <mangaUuid>, --list-groups <mangaUuid>, or --find-group <name>.');
      process.exit(1);
    }
    console.log(`Searching MangaDex for "${query}"...\n`);
    const results = await mangadexSource.search(query);
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

  const groupIds = groupsFlag ? await resolveGroupIds(groupsFlag.split(',')) : undefined;

  if (toDb) {
    let sinceChapterNumber: number | undefined;
    if (incremental) {
      const source = await prisma.source.findUnique({ where: { slug: 'mangadex' } });
      const listing = source
        ? await prisma.seriesListing.findUnique({
            where: { sourceId_externalId: { sourceId: source.id, externalId } },
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
      sourceId: 'mangadex',
      externalId,
      chapterLimit,
      groupIds,
      sinceChapterNumber,
    });

    console.log(`\nImported "${result.title}"`);
    console.log(`  series id:   ${result.seriesId}`);
    console.log(`  listing id:  ${result.listingId}`);
    console.log(`  chapters:    ${result.chaptersWritten} written (${result.newChapters} new)`);
    console.log(`  scanlators:  ${result.scanlators.join(', ') || 'unknown'}`);
    console.log(`\nRead it at:  /series/${result.seriesId}`);
    return;
  }

  const [meta, chapters] = await Promise.all([
    mangadexSource.getSeries(externalId),
    mangadexSource.getChapters(externalId, { groupIds, limit: chapterLimit ?? 25 }),
  ]);

  if (!meta) {
    console.error('Series not found on MangaDex.');
    process.exit(1);
  }

  console.log(`${meta.title}${meta.author ? ` by ${meta.author}` : ''} [${meta.status}]`);
  console.log(`cover: ${meta.cover}`);
  console.log(`tags:  ${meta.tags.join(', ') || 'none'}\n`);

  const byGroup = new Map<string, number>();
  for (const chapter of chapters) {
    const key = chapter.groupName ? `${chapter.groupName}${chapter.official ? ' (official)' : ''}` : 'unattributed';
    byGroup.set(key, (byGroup.get(key) || 0) + 1);
  }
  console.log('Chapters by scanlator:');
  for (const [group, count] of byGroup) console.log(`  ${String(count).padStart(4)}  ${group}`);

  console.log('\nFirst chapters:');
  for (const chapter of chapters.slice(0, 10)) {
    console.log(
      `  ch ${String(chapter.number).padEnd(5)} ${chapter.title || '(untitled)'} [${chapter.language}] ` +
        `${chapter.pageCount}p  ${chapter.groupName || 'no group'}  ${chapter.publishedAt.slice(0, 10)}`
    );
  }

  console.log(
    `\nPage URLs are intentionally NOT printed: they expire in ~15 minutes.\n` +
      `Resolve at read time with GET /api/chapter/<id>/pages after importing with --db.\n`
  );
}

main()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
