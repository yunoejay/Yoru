/**
 * Print the resolved reading order (one chapter per number) for every series.
 *
 * Run with:  npm run check:order
 *
 * This walks the exact same code path the UI uses (listSeriesViews ->
 * buildReadingOrder in lib/content.ts), so the output is what the series page
 * and the reader's Prev/Next will show. Useful to re-run after a sync to confirm
 * the scanlator hand-offs look right.
 */
import { listSeriesViews } from '../lib/content';

async function main() {
  const series = await listSeriesViews();
  if (!series.length) {
    console.log('No series found.');
    return;
  }

  for (const s of series) {
    console.log(`\n=== ${s.title} (${s.chapters.length} chapters) ===`);
    for (const c of s.chapters) {
      const pages = c.pageCount ? `${c.pageCount}p` : '0p';
      const group = c.groupName ?? '—';
      console.log(`  Ch. ${String(c.number).padStart(4)}  ${group.padEnd(20)}  ${pages}`);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
