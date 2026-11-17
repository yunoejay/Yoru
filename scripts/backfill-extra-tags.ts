/**
 * Backfill the tags -> extraTags split for series already in the database.
 *
 * Adding `extraTags` only affects *new* imports: rows synced before the change
 * still have their genres, themes and format labels merged into the single
 * `tags` array, so the series page would keep showing the whole wall of pills
 * inline with an empty dropdown. This refreshes each series' metadata from its
 * own (still-enabled) source, which now returns the split, and writes both
 * lists back. It re-fetches metadata only — chapters are never touched.
 *
 * Usage:
 *   npx tsx scripts/backfill-extra-tags.ts --dry        # preview, no writes
 *   npx tsx scripts/backfill-extra-tags.ts              # apply to every series
 *   npx tsx scripts/backfill-extra-tags.ts --limit 10   # apply to the 10 newest
 *
 * Atsumaru/MangaDex requests are throttled by the shared polite-fetch bucket,
 * so a large library takes a while — run it with --dry first.
 */

import prisma from '../lib/prisma';
import { getSource } from '../lib/sources';
import type { SourceSeries } from '../lib/sources/types';

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : undefined;

  const series = await prisma.series.findMany({
    include: { listings: { include: { source: true } } },
    orderBy: { updatedAt: 'desc' },
    ...(limit && Number.isFinite(limit) ? { take: limit } : {}),
  });

  let updated = 0;
  let skipped = 0;

  for (const row of series) {
    let fresh: SourceSeries | null = null;
    for (const listing of row.listings) {
      const source = getSource(listing.source.slug);
      // A disabled scraper/adapter won't answer, so never request through it.
      if (!source || !source.enabled) continue;
      try {
        const meta = await source.getSeries(listing.externalId);
        if (meta) {
          fresh = meta;
          break;
        }
      } catch (error) {
        console.warn(`  ! "${row.title}" via ${source.id}: ${(error as Error).message}`);
      }
    }

    if (!fresh) {
      skipped += 1;
      console.log(`skip  "${row.title}" (no enabled source answered)`);
      continue;
    }

    const tags = fresh.tags;
    const extraTags = fresh.extraTags ?? [];
    const unchanged =
      JSON.stringify(tags) === JSON.stringify(row.tags) &&
      JSON.stringify(extraTags) === JSON.stringify(row.extraTags);

    if (unchanged) {
      console.log(`ok    "${row.title}" already split (${tags.length} tags / ${extraTags.length} extra)`);
      continue;
    }

    console.log(
      `${dry ? 'would' : 'split'} "${row.title}": ${tags.length} tags / ${extraTags.length} extra`
    );
    if (!dry) {
      await prisma.series.update({ where: { id: row.id }, data: { tags, extraTags } });
    }
    updated += 1;
  }

  console.log(
    `\n${dry ? 'Would update' : 'Updated'} ${updated} series, skipped ${skipped}${
      dry ? ' (re-run without --dry to apply)' : ''
    }.`
  );
}

main()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
