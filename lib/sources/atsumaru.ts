/**
 * Atsumaru adapter - a *sanctioned, API-based* source (no scraping).
 *
 * Atsumaru (https://atsu.moe) is a reader built on top of MangaBaka, a manga
 * metadata + scanlation aggregator with a stable JSON API. It is included here
 * because it gives the app a second fast source that is NOT the MangaDex API:
 *
 *   - MangaDex pages are served from rate-limited MangaDex@Home volunteer nodes
 *     (`*.mangadex.network`), which are noticeably slower and require per-image
 *     health reports.
 *   - Atsumaru serves its pages from its own edge CDN (`cdn.atsu.moe`), which
 *     responded in well under a second in testing (9/14/2026) and needs no
 *     reports. It also carries many scanlators, so it broadens the catalog.
 *
 * Why `legal: true`: this talks to a documented,
 * public JSON API the same way the MangaDex adapter does - it never drives a
 * browser, never replays a JS challenge, and never circumvents an anti-bot
 * wall. It is still an unofficial fan aggregator, so credit the upstream and
 * honor takedowns exactly as you would for MangaDex.
 *
 * The API is same-origin to the SPA and its real routes live under
 * `https://atsu.moe/api/...` (the frontend is a Hono typed client rooted at
 * `.api`). Verified against the live API on 2026-09-14:
 *
 *   GET /api/search/manga?q=<query>&query_by=title&per_page=<n>
 *       -> {hits:[{document:{id,title,poster,status,type,...}}]}
 *   GET /api/manga/page?id=<mangaId>
 *       -> {mangaPage:{title,synopsis,poster,genres,status,authors,scanlators,
 *                     totalChapterCount,hasMoreChapters,chapters:[...]}}
 *   GET /api/manga/allChapters?mangaId=<mangaId>
 *       -> {chapters:[{id,number,title,pageCount,createdAt,scanlationMangaId}]}
 *   GET /api/read/chapter?mangaId=<mangaId>&chapterId=<chapterId>
 *       -> {readChapter:{pages:[{image:"/static/pages/<scanManga>/<chap>/N.webp",
 *                                number,width,height}]}}
 *
 * Images are relative to the CDN: `https://cdn.atsu.moe` + `page.image`.
 */

import {
  ChapterQuery,
  ScanlationSource,
  SearchHit,
  SourceChapter,
  SourcePage,
  SourceSeries,
} from './types';
import { politeJson } from './http';
import { normalizeSeriesFormat } from '../formats';

const API = 'https://atsu.moe/api';
const CDN = 'https://cdn.atsu.moe';
const BUCKET = 'atsu.moe';

/**
 * Chapter identity is a composite of the series id and the chapter id, because
 * `read/chapter` needs BOTH. getPages reconstructs them by splitting on the
 * first "/", so the composite is what we persist as `SourceChapter.externalId`.
 */
function chapterRef(mangaId: string, chapterId: string): string {
  return `${mangaId}/${chapterId}`;
}

function splitRef(externalId: string): { mangaId: string; chapterId: string } | null {
  const i = externalId.indexOf('/');
  if (i <= 0 || i === externalId.length - 1) return null;
  return { mangaId: externalId.slice(0, i), chapterId: externalId.slice(i + 1) };
}

/** Turn an Atsumaru relative asset path into an absolute CDN URL. */
function cdnUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${CDN}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Build a cover URL from a `manga/page` poster path.
 *
 * The `/manga/page` `poster` object returns bare relative paths like
 * `posters/<id>-medium.avif`, but the CDN only serves assets under `/static/`
 * (`https://cdn.atsu.moe/static/posters/...`; without the prefix it 404s). The
 * search endpoint already hands back `/static/...`, so only this path needs the
 * prefix normalised in.
 */
function posterUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const withoutLeadingSlash = path.replace(/^\/+/, '');
  const normalised = withoutLeadingSlash.startsWith('static/')
    ? withoutLeadingSlash
    : `static/${withoutLeadingSlash}`;
  return cdnUrl(normalised);
}

interface AtsumaruPoster {
  image?: string | null;
  mediumImage?: string | null;
  largeImage?: string | null;
  smallImage?: string | null;
}

interface AtsumaruScanlator {
  id: string;
  name?: string | null;
}

interface AtsumaruGenre {
  name?: string | null;
}

interface AtsumaruChapter {
  id: string;
  number?: number | null;
  title?: string | null;
  pageCount?: number | null;
  createdAt?: number | null;
  scanlationMangaId?: string | null;
}

interface AtsumaruMangaPage {
  id?: string;
  title?: string | null;
  synopsis?: string | null;
  poster?: AtsumaruPoster | null;
  genres?: AtsumaruGenre[] | null;
  tags?: AtsumaruGenre[] | null;
  status?: string | null;
  /** Origin classification: "Manwha" (MangaBaka's spelling), "Manga", "Manhua", "OEL". */
  type?: string | null;
  /** "Comic" (image pages) or "Novel" (text light novel). */
  medium?: string | null;
  authors?: Array<{ name?: string | null }> | null;
  scanlators?: AtsumaruScanlator[] | null;
  chapters?: AtsumaruChapter[] | null;
  totalChapterCount?: number | null;
}

/** The raw shape MangaBaka returns for one title in its Typesense collection. */
interface AtsumaruSearchDoc {
  id: string;
  title?: string | null;
  synopsis?: string | null;
  poster?: string | null;
  medium?: string | null;
  type?: string | null;
  status?: string | null;
  chapterCount?: number | null;
  authors?: string[] | null;
  year?: number | null;
  isAdult?: boolean | null;
  mbRating?: number | null;
}

/**
 * One catalog document from `search/manga`, the endpoint atsu.moe's own browse
 * page is built on (an empty `q` plus `page`/`per_page` walks the whole
 * collection, ~27k titles).
 *
 * It is exposed because it carries the one field `manga/page` does not make
 * cheap: `medium`. MangaBaka stores the manhwa and the light novel it was
 * adapted from as separate documents with near-identical titles, and only the
 * comic is readable here as images - `Return of The Mount Hua Sect` exists as a
 * 1,394-chapter Novel and as the ~180-chapter manhwa comic.
 */
export interface AtsumaruCatalogDocument {
  id: string;
  title: string;
  synopsis: string;
  /** "Comic" (scanned, image pages) or "Novel" (text light novel). */
  medium: string | null;
  /** "Manwha" (MangaBaka's own misspelling), "Manga", "Manhua", "OEL". */
  type: string | null;
  status: string | null;
  /** Distinct chapter numbers across every scanlator. */
  chapterCount: number;
  authors: string[];
  year: number | null;
  isAdult: boolean;
  rating: number | null;
  cover: string | null;
}

export interface CatalogSearchOptions {
  /** Empty string browses the collection instead of matching a title. */
  q?: string;
  /** 1-based page. `page * perPage` stops returning hits past the collection size. */
  page?: number;
  /** Typesense serves at most 250 hits per request. */
  perPage?: number;
  /** Passed straight through, e.g. `medium:=Comic && isAdult:=false`. */
  filterBy?: string;
}

/** Search or browse the catalog with the metadata importers need. */
export async function searchCatalog(
  options: CatalogSearchOptions = {}
): Promise<AtsumaruCatalogDocument[]> {
  const params = new URLSearchParams({
    q: options.q ?? '',
    query_by: 'title',
    per_page: String(options.perPage ?? 250),
    page: String(options.page ?? 1),
  });
  if (options.filterBy) params.set('filter_by', options.filterBy);

  const data = await politeJson<{ hits?: Array<{ document?: AtsumaruSearchDoc }> }>(
    `${API}/search/manga?${params.toString()}`,
    { bucket: BUCKET }
  );

  const seen = new Set<string>();
  const docs: AtsumaruCatalogDocument[] = [];
  for (const hit of data.hits ?? []) {
    const doc = hit.document;
    if (!doc?.id || seen.has(doc.id)) continue;
    seen.add(doc.id);
    docs.push({
      id: doc.id,
      title: doc.title || 'Untitled',
      synopsis: doc.synopsis ?? '',
      medium: doc.medium ?? null,
      type: doc.type ?? null,
      status: doc.status ?? null,
      chapterCount: doc.chapterCount ?? 0,
      authors: (doc.authors ?? []).filter((a): a is string => Boolean(a)),
      year: doc.year ?? null,
      isAdult: Boolean(doc.isAdult),
      rating: typeof doc.mbRating === 'number' ? doc.mbRating : null,
      cover: cdnUrl(doc.poster),
    });
  }
  return docs;
}

/**
 * The scanlators MangaBaka lists for a title. Useful before importing: if the
 * group you are cross-checking against is in here, the two titles really are the
 * same work.
 */
export async function listScanlators(mangaId: string): Promise<AtsumaruScanlator[]> {
  const data = await politeJson<{ mangaPage?: AtsumaruMangaPage | null }>(
    `${API}/manga/page?id=${encodeURIComponent(mangaId)}`,
    { bucket: BUCKET }
  );
  return (data.mangaPage?.scanlators ?? []).filter(s => s.id && s.name);
}

function toStatus(status?: string | null): SourceSeries['status'] {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s === 'hiatus') return s as 'completed' | 'hiatus';
  return 'ongoing';
}

function publishIso(ms?: number | null): string {
  if (!ms) return new Date(0).toISOString();
  return new Date(ms).toISOString();
}

/**
 * The scanlator display name for a chapter. `allChapters` gives us only the
 * scanlationMangaId, so we map it through the id->name table harvested from the
 * manga page's `scanlators` list.
 */
function groupNameFor(chapter: AtsumaruChapter, scanlators: Map<string, string>): string | null {
  if (chapter.scanlationMangaId) {
    const name = scanlators.get(chapter.scanlationMangaId);
    if (name) return name;
  }
  if (scanlators.size === 1) return Array.from(scanlators.values())[0];
  return null;
}

function mapChapter(
  mangaId: string,
  chapter: AtsumaruChapter,
  scanlators: Map<string, string>
): SourceChapter {
  const number = Number.isFinite(chapter.number as number) ? (chapter.number as number) : 0;
  return {
    externalId: chapterRef(mangaId, chapter.id),
    number,
    volume: null,
    title: chapter.title ?? `Chapter ${chapter.number ?? ''}`.trim(),
    groupName: groupNameFor(chapter, scanlators),
    groupId: chapter.scanlationMangaId ?? null,
    official: false,
    language: 'en',
    pageCount: chapter.pageCount ?? 0,
    publishedAt: publishIso(chapter.createdAt),
    externalUrl: null,
  };
}

export const atsumaruSource: ScanlationSource = {
  id: 'atsumaru',
  label: 'Atsumaru (MangaBaka)',
  legal: true,
  enabled: process.env.ATSUMARU_ENABLED !== 'false',

  async search(query: string): Promise<SearchHit[]> {
    const docs = await searchCatalog({ q: query, perPage: 20 });
    return docs.map(doc => ({
      externalId: doc.id,
      title: doc.title,
      cover: doc.cover,
    }));
  },

  async getSeries(externalId: string): Promise<SourceSeries | null> {
    const data = await politeJson<{ mangaPage?: AtsumaruMangaPage | null }>(
      `${API}/manga/page?id=${encodeURIComponent(externalId)}`,
      { bucket: BUCKET }
    );
    const page = data.mangaPage;
    if (!page || !page.id) return null;

    const genreNames = (page.genres ?? [])
      .map(g => g.name)
      .filter((n): n is string => Boolean(n));
    // MangaBaka splits genres from looser "tags" (themes / settings); the tag
    // list is the long tail the UI collapses behind a "More tags" toggle.
    const themeNames = (page.tags ?? [])
      .map(t => t.name)
      .filter((n): n is string => Boolean(n));

    const author = (page.authors ?? []).map(a => a.name).find(Boolean) ?? null;

    // Tag the real origin instead of calling every title a manga. MangaBaka's
    // `type` is the authority here ("Manwha" — its spelling — "Manga",
    // "Manhua", "OEL"); when it is unknown, leave the format untagged rather
    // than mislabelling a Korean manhwa as Japanese manga.
    const format = normalizeSeriesFormat(page.type);

    return {
      externalId: page.id,
      title: page.title || 'Untitled',
      cover:
        posterUrl(page.poster?.mediumImage) ||
        posterUrl(page.poster?.image) ||
        posterUrl(page.poster?.largeImage) ||
        posterUrl(page.poster?.smallImage) ||
        '',
      description: page.synopsis || '',
      tags: Array.from(
        new Set([
          ...(format ? [format] : []),
          'aggregator',
          ...genreNames.map(t => t.toLowerCase()),
        ])
      ),
      extraTags: Array.from(new Set(themeNames.map(t => t.toLowerCase()))),
      status: toStatus(page.status),
      author,
    };
  },

  async getChapters(externalId: string, query: ChapterQuery = {}): Promise<SourceChapter[]> {
    const [pageData, allData] = await Promise.all([
      politeJson<{ mangaPage?: AtsumaruMangaPage | null }>(
        `${API}/manga/page?id=${encodeURIComponent(externalId)}`,
        { bucket: BUCKET }
      ).catch(() => null),
      politeJson<{ chapters?: AtsumaruChapter[] }>(
        `${API}/manga/allChapters?mangaId=${encodeURIComponent(externalId)}`,
        { bucket: BUCKET }
      ),
    ]);

    const scanlators = new Map<string, string>();
    for (const s of pageData?.mangaPage?.scanlators ?? []) {
      if (s.id && s.name) scanlators.set(s.id, s.name);
    }

    // Prefer the full list; fall back to the (truncated) page list if the
    // allChapters route comes back empty.
    const source =
      allData?.chapters && allData.chapters.length
        ? allData.chapters
        : pageData?.mangaPage?.chapters ?? [];

    const chapters = source.map(c => mapChapter(externalId, c, scanlators));
    chapters.sort((a, b) => a.number - b.number);

    if (query.limit) return chapters.slice(0, query.limit);
    return chapters;
  },

  async getPages(chapter: SourceChapter): Promise<SourcePage[]> {
    const ref = splitRef(chapter.externalId);
    if (!ref) return [];

    const url = `${API}/read/chapter?mangaId=${encodeURIComponent(ref.mangaId)}&chapterId=${encodeURIComponent(ref.chapterId)}`;
    const data = await politeJson<{
      readChapter?: { pages?: Array<{ image?: string | null; number?: number | null }> };
    }>(url, { bucket: BUCKET });

    const pages = (data.readChapter?.pages ?? [])
      .map((p, i) => {
        const absolute = cdnUrl(p.image);
        if (!absolute) return null;
        const index = Number.isFinite(p.number as number) ? (p.number as number) : i;
        return { index, url: absolute } as { index: number; url: string };
      })
      .filter((p): p is { index: number; url: string } => Boolean(p));

    pages.sort((a, b) => a.index - b.index);

    return pages.map((p, index) => ({
      index,
      url: p.url,
      requiresReport: false,
    }));
  },
};

