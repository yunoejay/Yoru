/**
 * Per-series scanlator coverage, and which scanlator the reading order follows.
 *
 * Run with:  npm run scanlators ["title or slug filter"]
 *
 * Two views of the same titles, deliberately:
 *   - the RAW rows (every chapter each group has), from Postgres
 *   - the COLLAPSED reading order the UI renders, from lib/content.ts
 *
 * The gap between them is the interesting part. `buildReadingOrder()` anchors on
 * the group with the most readable chapters and only leaves it when that group is
 * missing a number, so importing a fuller scan from an aggregator can quietly
 * take a series over - a 201-chapter Alpha run will out-vote a 200-chapter
 * run imported first. This prints both so the handover is visible
 * instead of something you notice while reading.
 */
import prisma from '../lib/prisma';
import { listSeriesViews } from '../lib/content';

interface Coverage {
  group: string;
  readable: number;
  missingPages: number;
  maxNumber: number;
  source: string;
}

function flag(value: string | null | undefined): string {
  return value ?? 'unattributed';
}

async function main() {
  const filter = process.argv.slice(2).join(' ').trim().toLowerCase();

  const [rows, views] = await Promise.all([
    prisma.series.findMany({
      include: {
        listings: { include: { source: true } },
        chapters: { select: { number: true, groupName: true, pageCount: true, listingId: true } },
      },
      orderBy: { title: 'asc' },
    }),
    listSeriesViews(),
  ]);

  for (const series of rows) {
    const view = views.find(v => v.id === (series.slug || series.id));
    if (filter && !`${series.title} ${series.slug ?? ''}`.toLowerCase().includes(filter)) continue;

    const byGroup = new Map<string, Coverage>();
    for (const chapter of series.chapters) {
      const group = flag(chapter.groupName);
      const entry = byGroup.get(group) ?? {
        group,
        readable: 0,
        missingPages: 0,
        maxNumber: -1,
        source: series.listings.find(l => l.id === chapter.listingId)?.source.slug ?? '?',
      };
      if (chapter.pageCount > 0) {
        entry.readable += 1;
        entry.maxNumber = Math.max(entry.maxNumber, chapter.number);
      } else {
        entry.missingPages += 1;
      }
      byGroup.set(group, entry);
    }

    const coverage = Array.from(byGroup.values()).sort((a, b) => b.readable - a.readable);
    const followed = view ? Array.from(new Set(view.chapters.map(c => flag(c.groupName)))) : [];
    console.log(
      `\n${series.title}  -  ${coverage.length} scanlator(s), ` +
        `${view ? view.chapters.length : '?'} chapters after collapse`
    );
    for (const entry of coverage) {
      const mark = followed.includes(entry.group) ? '*' : ' ';
      console.log(
        `  ${mark} ${entry.group.padEnd(14)} ${String(entry.readable).padStart(5)} readable` +
          `${entry.missingPages ? ` + ${entry.missingPages} link-only` : ''}` +
          `${entry.maxNumber >= 0 ? `, up to ch ${entry.maxNumber}` : ''}  (${entry.source})`
      );
    }
    if (followed.length) console.log(`  reading order follows: ${followed.join(' -> ')}`);
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
