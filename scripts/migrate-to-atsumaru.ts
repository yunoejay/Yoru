/**
 * Move the library onto Atsumaru (atsu.moe / MangaBaka) only.
 *
 * The original imports came from the Asura scraper: 12 series whose chapters,
 * covers, titles and tags all came from asurascans.com. This script replaces
 * that data with the same works' Atsumaru listings, then deletes the scraped
 * Asura rows entirely:
 *
 *   1. Every scraped series is re-synced from its existing Atsumaru listing with
 *      `overwriteSeriesMeta: true`, so the cover, title, synopsis, tags and
 *      author also come from atsu.moe (not just the chapters). That listing
 *      carries *every* scanlation group, so nothing is lost.
 *   2. A scraped series with no Atsumaru listing can be imported with --map
 *      (Star-Embracing Swordmaster is on Atsumaru as "The Stellar Swordmaster").
 *   3. All `asura` chapters, listings and the `asura` source row are deleted.
 *   4. Any series left with zero listings is deleted - Atsumaru does not carry
 *      it, so there is nothing left to read. Its library entries cascade with it.
 *
 * Everything is written only after every Atsumaru import has succeeded, so a
 * network failure aborts before any Asura data is removed.
 *
 * Usage:
 *   npm run migrate:atsumaru
 *       Dry run: show what each series maps to and what would be deleted.
 *
 *   npm run migrate:atsumaru -- --apply
 *       Write it.
 *
 *   npm run migrate:atsumaru -- \
 *     --map "star-embracing-swordmaster=n86El" --apply
 *       Attach a scraped series to a specific Atsumaru manga id (the key
 *       matches the series slug, id or title, case-insensitive).
 */

import prisma from '../lib/prisma';
import { atsumaruSource } from '../lib/sources/atsumaru';
import { importSeriesFromSource } from '../lib/sync';

function flagValues(args: string[], flag: string): string[] {
  const out: string[] = [];
  args.forEach((arg, i) => {
    const next = args[i + 1];
    if (arg === flag && next && !next.startsWith('--')) out.push(next);
  });
  return out;
}

/** Same folding as scripts/add-atsumaru-scanlators.ts, so --map keys match. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘ʼ`'"]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseMap(entries: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    const split = entry.lastIndexOf('=');
    if (split <= 0) {
      console.error(`Ignoring --map "${entry}" (expected "series=atsumaruMangaId").`);
      continue;
    }
    map.set(normalize(entry.slice(0, split)), entry.slice(split + 1).trim());
  }
  return map;
}

interface MigrationTarget {
  seriesId: string;
  title: string;
  slug: string | null;
  /** Atsumaru listing already attached to this series. */
  attachedId: string | null;
  /** Atsumaru id supplied with --map for a series that has no listing yet. */
  mappedId: string | null;
  asuraChapterCount: number;
  /** How many readers had this series in their personal library. */
  libraryEntries: number;
}

function describe(target: MigrationTarget): string {
  if (target.attachedId) {
    return `re-sync Atsumaru ${target.attachedId} (metadata + chapters replace Asura)`;
  }
  if (target.mappedId) {
    return `import Atsumaru ${target.mappedId} onto this series (metadata + chapters)`;
  }
  return 'NO Atsumaru replacement - the series will be deleted';
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const forced = parseMap(flagValues(args, '--map'));

  if (!atsumaruSource.enabled) {
    console.error('The Atsumaru source is disabled. Remove ATSUMARU_ENABLED=false from .env.local.');
    process.exit(1);
  }

  const asura = await prisma.source.findUnique({ where: { slug: 'asura' } });
  if (!asura) {
    console.log('There is no "asura" source row - the library is already Atsumaru-only.');
    return;
  }

  const seriesRows = await prisma.series.findMany({
    where: { listings: { some: { sourceId: asura.id } } },
    include: {
      listings: { include: { source: true } },
      _count: { select: { libraryEntries: true } },
    },
    orderBy: { title: 'asc' },
  });

  const asuraListingIds = seriesRows.flatMap(row =>
    row.listings.filter(listing => listing.sourceId === asura.id).map(listing => listing.id)
  );
  const asuraChapterCount = await prisma.chapter.count({
    where: { listingId: { in: asuraListingIds } },
  });

  const targets: MigrationTarget[] = [];
  for (const row of seriesRows) {
    const attached = row.listings.find(listing => listing.source.slug === 'atsumaru');
    const mapped =
      forced.get(normalize(row.title)) ??
      forced.get(normalize(row.slug ?? '')) ??
      forced.get(normalize(row.id)) ??
      null;
    const asuraListing = row.listings.find(listing => listing.sourceId === asura.id);
    targets.push({
      seriesId: row.id,
      title: row.title,
      slug: row.slug,
      attachedId: attached?.externalId ?? null,
      mappedId: mapped,
      asuraChapterCount: asuraListing
        ? await prisma.chapter.count({ where: { listingId: asuraListing.id } })
        : 0,
      libraryEntries: row._count.libraryEntries,
    });
  }

  console.log(
    apply
      ? 'MIGRATING the library to Atsumaru (writing).\n'
      : 'DRY RUN - nothing is written. Re-run with --apply to migrate.\n'
  );
  console.log(
    `Asura scraper data: ${asuraListingIds.length} listing(s), ` +
      `${asuraChapterCount} chapter(s) across ${targets.length} series.\n`
  );

  for (const target of targets) {
    console.log(`${target.title}  (${target.asuraChapterCount} Asura chapters)`);
    console.log(`  -> ${describe(target)}`);
    if (!target.attachedId && !target.mappedId) {
      const notes = ['series row removed'];
      if (target.libraryEntries) {
        notes.push(`${target.libraryEntries} library entr${target.libraryEntries === 1 ? 'y' : 'ies'} removed with it`);
      }
      console.log(`     ${notes.join(', ')}`);
      console.log(
        `     If it is on Atsumaru under another name, re-run with ` +
          `--map "${target.slug ?? target.title}=<atsumaruId>"`
      );
    }
    console.log('');
  }

  if (!apply) {
    console.log('Dry run only - no changes were made.');
    return;
  }

  // 1. Atsumaru first. If any import fails we abort while the scraped data is
  //    still intact, so a bad id or a network error can never empty a series.
  for (const target of targets) {
    const externalId = target.attachedId ?? target.mappedId;
    if (!externalId) continue;

    try {
      const result = await importSeriesFromSource({
        sourceId: 'atsumaru',
        externalId,
        targetSeriesId: target.seriesId,
        overwriteSeriesMeta: true,
      });
      console.log(
        `  ${target.attachedId ? 're-synced' : 'imported'} "${result.title}" ` +
          `from Atsumaru ${externalId}: ${result.chaptersWritten} chapters ` +
          `(${result.newChapters} new, ${result.scanlators.length} scanlators)`
      );
    } catch (error) {
      console.error(
        `\nFailed to move "${target.title}" to Atsumaru ${externalId}: ` +
          `${(error as Error).message}\n` +
          'Aborting BEFORE deleting any Asura data. Nothing was removed.'
      );
      process.exitCode = 1;
      return;
    }
  }

  // 2. Remove the scraped chapters, then their listings and the source row.
  //    Chapters cascade with the listing, but deleting them explicitly keeps the
  //    printed count honest and makes the intent obvious.
  const deletedChapters = await prisma.chapter.deleteMany({
    where: { listingId: { in: asuraListingIds } },
  });
  const deletedListings = await prisma.seriesListing.deleteMany({
    where: { sourceId: asura.id },
  });
  await prisma.source.delete({ where: { id: asura.id } });

  console.log(
    `\nDeleted ${deletedChapters.count} Asura chapter(s), ` +
      `${deletedListings.count} listing(s) and the "asura" source row.`
  );

  // 3. Drop series that no longer have any listing (not available on Atsumaru).
  const leftovers = await prisma.series.findMany({
    where: { id: { in: targets.map(target => target.seriesId) } },
    select: { id: true, title: true, _count: { select: { listings: true, libraryEntries: true } } },
    orderBy: { title: 'asc' },
  });
  const orphans = leftovers.filter(row => row._count.listings === 0);

  if (orphans.length) {
    await prisma.series.deleteMany({ where: { id: { in: orphans.map(row => row.id) } } });
    console.log('Deleted series with no Atsumaru listing:');
    for (const orphan of orphans) {
      console.log(
        `  - ${orphan.title}` +
          (orphan._count.libraryEntries
            ? ` (${orphan._count.libraryEntries} library entr${orphan._count.libraryEntries === 1 ? 'y' : 'ies'})`
            : '')
      );
    }
  }

  console.log('\nDone. The library now reads only through Atsumaru.');
}

main()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

