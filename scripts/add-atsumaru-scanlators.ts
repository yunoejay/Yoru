/**
 * Attach every Atsumaru scanlator to series imported from another source.
 *
 * Why: a series imported from a single source/group is single-scanlator by
 * construction - every chapter row belongs to one group. Atsumaru (MangaBaka)
 * carries those same titles with *every* group that uploaded them, and one
 * listing already holds them all because `/manga/allChapters` is not
 * group-filtered (Solo Leveling on Atsumaru: Asura, Alpha, Dusk, Flame = 802
 * chapter rows across 201 numbers). So "add all scanlators" is one import per
 * title, not one per group, and nothing has to be switched afterwards.
 *
 * The new listing is attached to the EXISTING series row (`targetSeriesId`) with
 * `overwriteSeriesMeta: false`, so the series keeps its own title, cover,
 * synopsis and tags - the series gains alternate scans instead of being
 * republished as the other source's entry. `buildReadingOrder()` in
 * lib/content.ts then collapses the duplicate chapter numbers into one linear
 * list that follows a single scanlator per run, so the series page never shows
 * "Chapter 2" four times.
 *
 * Matching is the risky part, so it is conservative and the script DRY-RUNS by
 * default. MangaBaka keeps a title's light novel and its manhwa as separate
 * documents with near-identical names (Return of The Mount Hua Sect: a 1,394
 * "chapter" Novel and the ~180-chapter Comic), so only `medium:=Comic` counts as
 * a match unless `--include-novel` is passed. Anything below the auto-accept
 * threshold is reported with a ready-to-run `--map` line instead of imported.
 *
 * Usage:
 *   npm run add:scanlators
 *       Dry run over every series that has no Atsumaru listing: show the
 *       chosen Atsumaru title, the scanlators it adds, and what would be written.
 *
 *   npm run add:scanlators -- --apply
 *       Actually write it.
 *
 *   npm run add:scanlators -- --map "Swordmaster’s Youngest Son=4v9Hp" --apply
 *       Force an Atsumaru manga id for a series the matcher will not guess.
 *       The key matches the series slug, id, or title (case-insensitive).
 *
 *   npm run add:scanlators -- --series "Nano Machine" --apply
 *       Restrict to one series. --all covers every series, not just those
 *       without an Atsumaru listing.
 *
 *   npm run add:scanlators -- --source mangadex --include-novel --include-adult
 *       Change which single-scanlator series are targeted, and relax the filters.
 *
 * Page URLs are never stored: they resolve at read time through
 * /api/chapter/[chapterId]/pages like every other chapter.
 */

import prisma from '../lib/prisma';
import { atsumaruSource, listScanlators, searchCatalog } from '../lib/sources/atsumaru';
import type { AtsumaruCatalogDocument } from '../lib/sources/atsumaru';
import { importSeriesFromSource } from '../lib/sync';

/** A match has to reach this to be imported without being force-mapped. */
const AUTO_ACCEPT_SCORE = 95;
/** Candidates below this are not worth showing at all. */
const SHOW_MIN_SCORE = 45;

/** Words that carry no meaning when comparing two titles. */
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'to', 'in', 'on', 'for', 'with', 'is']);

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  const next = index >= 0 ? args[index + 1] : undefined;
  return next && !next.startsWith('--') ? next : undefined;
}

/** Repeatable flags (`--map a=b --map c=d`). */
function flagValues(args: string[], flag: string): string[] {
  const out: string[] = [];
  args.forEach((arg, i) => {
    const next = args[i + 1];
    if (arg === flag && next && !next.startsWith('--')) out.push(next);
  });
  return out;
}

/**
 * Lowercase, strip accents AND apostrophes (so "Swordmaster’s" folds into
 * "swordmasters" instead of leaving a stray "s" token), then collapse every
 * other run of punctuation into a single space.
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘ʼ`'"]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalize(value).split(' ').filter(word => word && !STOPWORDS.has(word)));
}

interface Candidate {
  doc: AtsumaruCatalogDocument;
  score: number;
  reason: string;
  /** How close the Atsumaru chapter count is to the chapters we already have. */
  countRatio: number;
}

function scoreCandidate(
  seriesTitle: string,
  existingMax: number,
  doc: AtsumaruCatalogDocument
): Candidate {
  const a = normalize(seriesTitle);
  const b = normalize(doc.title);
  const ta = tokens(seriesTitle);
  const tb = tokens(doc.title);

  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared += 1;
  const union = new Set([...ta, ...tb]).size || 1;

  let score: number;
  let reason: string;
  if (a === b) {
    score = 100;
    reason = 'identical title';
  } else if (a.startsWith(b) || b.startsWith(a)) {
    // "Pick Me Up, Infinite Gacha" (Asura) vs "Pick Me Up" (MangaBaka).
    score = 82;
    reason = 'one title starts with the other';
  } else {
    score = Math.round((shared / union) * 70);
    reason = `${shared}/${ta.size} title words match`;
  }

  // Novel = the source light novel, not the manhwa. Its "chapters" are prose
  // entries, so counting one as a scan of the same work is always wrong.
  if (doc.medium === 'Comic') score += 18;
  else if (doc.medium === 'Novel') score -= 60;

  const countRatio =
    doc.chapterCount && existingMax
      ? Math.min(doc.chapterCount, existingMax) / Math.max(doc.chapterCount, existingMax)
      : 0;
  score += Math.round(countRatio * 20);

  return { doc, score, reason, countRatio };
}

/** A few phrasings, because Typesense ranks by title tokens, not by our titles. */
function queryVariants(title: string): string[] {
  const cleaned = normalize(title);
  const words = cleaned.split(' ').filter(Boolean);
  const variants = new Set<string>([cleaned]);
  if (words.length > 4) {
    variants.add(words.slice(0, 4).join(' '));
    variants.add(words.slice(0, 2).join(' '));
  }
  return Array.from(variants).filter(variant => variant.length > 2);
}

async function findCandidates(
  seriesTitle: string,
  existingMax: number,
  options: { novels: boolean; adult: boolean }
): Promise<Candidate[]> {
  const filters: string[] = [];
  if (!options.adult) filters.push('isAdult:=false');
  if (!options.novels) filters.push('medium:=Comic');

  const seen = new Map<string, Candidate>();
  for (const query of queryVariants(seriesTitle)) {
    const docs = await searchCatalog({
      q: query,
      perPage: 20,
      filterBy: filters.length ? filters.join(' && ') : undefined,
    });
    for (const doc of docs) {
      const candidate = scoreCandidate(seriesTitle, existingMax, doc);
      const previous = seen.get(doc.id);
      if (!previous || previous.score < candidate.score) seen.set(doc.id, candidate);
    }
  }
  return Array.from(seen.values()).sort((x, y) => y.score - x.score);
}

interface TargetSeries {
  id: string;
  title: string;
  slug: string | null;
  existingMax: number;
  groups: string[];
  /** Atsumaru listings already attached, so a re-run just re-syncs. */
  attached: string[];
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

/**
 * Re-sync the Atsumaru listings a series already has instead of re-matching it.
 *
 * Without this, a second run reports finished work as "needs a human decision",
 * because the fuzzy matcher cannot re-derive a renamed title on its own - the
 * mapping already lives in the database as a SeriesListing, so read it from there.
 */
async function reSyncAttached(target: TargetSeries, chapterLimit?: number) {
  let listings = 0;
  let rows = 0;
  for (const externalId of target.attached) {
    const result = await importSeriesFromSource({
      sourceId: 'atsumaru',
      externalId,
      targetSeriesId: target.id,
      overwriteSeriesMeta: false,
      chapterLimit,
    });
    listings += 1;
    rows += result.chaptersWritten;
    console.log(`  re-synced ${externalId}: ${result.chaptersWritten} rows (${result.newChapters} new)`);
  }
  return { listings, rows };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const every = args.includes('--all');
  const includeNovel = args.includes('--include-novel');
  const includeAdult = args.includes('--include-adult');
  const sourceSlug = flagValue(args, '--source');
  const onlySeries = flagValue(args, '--series');
  const chapterLimitValue = flagValue(args, '--limit');
  const chapterLimit = chapterLimitValue ? Number(chapterLimitValue) : undefined;
  const forced = parseMap(flagValues(args, '--map'));

  if (!atsumaruSource.enabled) {
    console.error('The Atsumaru source is disabled. Remove ATSUMARU_ENABLED=false from .env.local.');
    process.exit(1);
  }
  if (chapterLimit !== undefined && !Number.isFinite(chapterLimit)) {
    console.error('--limit must be a number.');
    process.exit(1);
  }

  const rows = await prisma.series.findMany({
    where: every
      ? undefined
      : sourceSlug
        ? { listings: { some: { source: { slug: sourceSlug } } } }
        : { listings: { none: { source: { slug: 'atsumaru' } } } },
    include: {
      listings: { include: { source: true } },
      chapters: { select: { number: true, groupName: true } },
    },
    orderBy: { title: 'asc' },
  });

  let targets: TargetSeries[] = rows.map(row => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    existingMax: row.chapters.reduce((max, chapter) => Math.max(max, chapter.number), 0),
    groups: Array.from(
      new Set(row.chapters.map(c => c.groupName).filter((g): g is string => Boolean(g)))
    ),
    attached: row.listings.filter(l => l.source.slug === 'atsumaru').map(l => l.externalId),
  }));

  if (onlySeries) {
    const needle = normalize(onlySeries);
    targets = targets.filter(
      t =>
        normalize(t.title).includes(needle) ||
        normalize(t.slug ?? '').includes(needle) ||
        t.id === onlySeries
    );
  }

  if (!targets.length) {
    console.log(
      onlySeries
        ? `No series matching "${onlySeries}".`
        : sourceSlug
          ? `No series with a "${sourceSlug}" listing. Use --all to cover every series.`
          : 'Every series already has an Atsumaru listing. Use --all to re-sync them.'
    );
    return;
  }

  console.log(
    apply
      ? `Attaching every Atsumaru scanlator to ${targets.length} series (writing).\n`
      : `DRY RUN - nothing is written. Checking ${targets.length} series.\n`
  );

  let imported = 0;
  let resynced = 0;
  let wouldImport = 0;
  let rowsWritten = 0;
  const groupsSeen = new Set<string>();
  const ambiguous: string[] = [];
  const notFound: string[] = [];
  const skipped: string[] = [];

  for (const target of targets) {
    const header = `${target.title}  (${target.groups.join(', ') || 'no group'}, max ch ${target.existingMax})`;

    const forcedId =
      forced.get(normalize(target.title)) ??
      forced.get(normalize(target.slug ?? '')) ??
      forced.get(normalize(target.id));

    if (forcedId && !/^[A-Za-z0-9_-]+$/.test(forcedId)) {
      console.log(`${header}\n  --map value "${forcedId}" is not an Atsumaru manga id. Skipping.\n`);
      skipped.push(`${target.title} (bad --map)`);
      continue;
    }

    // Already done on an earlier run: trust the stored listing over the matcher.
    if (!forcedId && target.attached.length) {
      console.log(
        `${header}\n  already attached (${target.attached.join(', ')}) - skipping the match, chapters only\n`
      );
      if (apply) {
        const done = await reSyncAttached(target, chapterLimit);
        resynced += done.listings;
        rowsWritten += done.rows;
      }
      continue;
    }

    let chosen: Candidate | null = null;
    let ranked: Candidate[] = [];

    if (forcedId) {
      const docs = await searchCatalog({ q: '', perPage: 1, filterBy: `id:=${forcedId}` });
      if (!docs.length) {
        console.log(`${header}\n  --map id ${forcedId} is not on Atsumaru. Skipping.\n`);
        skipped.push(`${target.title} (unknown --map id)`);
        continue;
      }
      chosen = scoreCandidate(target.title, target.existingMax, docs[0]);
      console.log(`${header}\n  forced by --map -> ${chosen.doc.id} "${chosen.doc.title}"`);
    } else {
      ranked = await findCandidates(target.title, target.existingMax, {
        novels: includeNovel,
        adult: includeAdult,
      });
      chosen = ranked[0] ?? null;
    }

    if (!chosen) {
      console.log(`${header}\n  not on Atsumaru.\n`);
      notFound.push(target.title);
      continue;
    }

    if (!forcedId) {
      const visible = ranked.filter(c => c.score >= SHOW_MIN_SCORE).slice(0, 3);
      console.log(header);
      if (!visible.length) {
        console.log(`  no comic candidate (best guess ${chosen.doc.id} "${chosen.doc.title}", score ${chosen.score})`);
      }
      for (const candidate of visible) {
        const mark = candidate === chosen ? '->' : '  ';
        console.log(
          `  ${mark} ${candidate.doc.id.padEnd(6)} ${candidate.doc.title}  ` +
            `[${candidate.doc.medium}/${candidate.doc.type}] ${candidate.doc.chapterCount}ch  ` +
            `score ${candidate.score} (${candidate.reason})`
        );
      }
    }

    const exactTitle = normalize(chosen.doc.title) === normalize(target.title);
    const strong =
      Boolean(forcedId) ||
      chosen.score >= AUTO_ACCEPT_SCORE ||
      (exactTitle && chosen.doc.medium === 'Comic');

    if (!strong) {
      console.log(
        `     too weak to import unattended. If it really is the same work:\n` +
          `       npm run add:scanlators -- --map "${target.slug ?? target.title}=${chosen.doc.id}" --apply\n`
      );
      ambiguous.push(`${target.title} -> ${chosen.doc.id} "${chosen.doc.title}" (score ${chosen.score})`);
      continue;
    }

    if (target.attached.includes(chosen.doc.id)) {
      console.log(`     already attached (${chosen.doc.id}) - chapters will only be re-synced`);
    }

    let groups: string[] = [];
    try {
      groups = (await listScanlators(chosen.doc.id)).map(s => s.name ?? s.id);
    } catch {
      groups = [];
    }
    const already = new Set(target.groups);
    const added = groups.filter(g => !already.has(g) && !already.has(`${g} Scans`));
    groups.forEach(g => groupsSeen.add(g));
    console.log(`     scanlators there: ${groups.join(', ') || 'unknown'}`);
    console.log(`     new to this series: ${added.join(', ') || 'none'}`);

    if (!apply) {
      wouldImport += 1;
      console.log('');
      continue;
    }

    const result = await importSeriesFromSource({
      sourceId: 'atsumaru',
      externalId: chosen.doc.id,
      targetSeriesId: target.id,
      overwriteSeriesMeta: false,
      chapterLimit,
    });
    imported += 1;
    rowsWritten += result.chaptersWritten;
    console.log(
      `     wrote ${result.chaptersWritten} chapter rows (${result.newChapters} new) -> /series/${result.seriesId}\n`
    );
  }

  console.log('='.repeat(78));
  console.log(
    apply
      ? `Imported ${imported} new Atsumaru listing(s)` +
        (resynced ? `, re-synced ${resynced} already-attached one(s)` : '') +
        `, ${rowsWritten} chapter rows written.`
      : `Would import ${wouldImport} Atsumaru listing(s). Re-run with --apply to write them.`
  );
  if (groupsSeen.size) {
    console.log(`Scanlators on offer: ${Array.from(groupsSeen).sort().join(', ')}`);
  }
  if (ambiguous.length) {
    console.log(`\nNeeds a human decision (${ambiguous.length}):`);
    ambiguous.forEach(t => console.log(`  ${t}`));
  }
  if (notFound.length) {
    console.log(`\nNot on Atsumaru (${notFound.length}) - they keep only their original scans:`);
    notFound.forEach(t => console.log(`  ${t}`));
  }
  if (skipped.length) {
    console.log(`\nSkipped (${skipped.length}):`);
    skipped.forEach(t => console.log(`  ${t}`));
  }
}

main()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

