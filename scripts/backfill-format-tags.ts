/**
 * Correct the format tag ("manga" / "manhwa" / "manhua" / "oel") on series
 * imported before the Atsumaru adapter read MangaBaka's `type`.
 *
 * Every title used to be tagged "manga", which is wrong for Korean manhwa and
 * Chinese manhua. This re-reads each series' source metadata and swaps the
 * stale format label for the real one; genres, themes and chapters are never
 * touched.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-format-tags.ts --dry
 *   npx tsx --env-file=.env.local scripts/backfill-format-tags.ts --limit 10
 *   npx tsx --env-file=.env.local scripts/backfill-format-tags.ts
 */

import prisma from '../lib/prisma';
import { getSource } from '../lib/sources';
import { isFormatTag } from '../lib/formats';

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
    const current = row.tags.find(isFormatTag);
    let fresh: string | null = null;

    for (const listing of row.listings) {
      const source = getSource(listing.source.slug);
      // A disabled adapter will not answer, so never request through it.
      if (!source || !source.enabled) continue;
      try {
        const meta = await source.getSeries(listing.externalId);
        const format = meta?.tags.find(isFormatTag);
        if (format) {
          fresh = format;
          break;
        }
      } catch (error) {
        console.warn(`  ! "${row.title}" via ${source.id}: ${(error as Error).message}`);
      }
    }

    if (!fresh) {
      console.log(`skip  "${row.title}" (source did not report a format)`);
      skipped += 1;
      continue;
    }

    if (fresh === current) {
      console.log(`ok    "${row.title}" already tagged "${fresh}"`);
      continue;
    }

    // Replace the format label in place so tag order stays stable, and drop any
    // duplicate format labels a source may have accumulated.
    const nextTags: string[] = [];
    for (const tag of row.tags) {
      const replacement = isFormatTag(tag) ? fresh : tag;
      if (!nextTags.includes(replacement)) nextTags.push(replacement);
    }

    console.log(`${dry ? 'would' : 'fix'} "${row.title}": "${current ?? 'none'}" -> "${fresh}"`);
    if (!dry) {
      await prisma.series.update({ where: { id: row.id }, data: { tags: nextTags } });
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
