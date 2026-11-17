/**
 * MangaDex adapter - the sanctioned, API-based source.
 *
 * Verified against the live API on 2026-09-10. Several things older notes
 * claimed are no longer true, and this file reflects current behaviour:
 *
 *   GET /manga/{id}/group           -> 404 "No route found"  (route removed)
 *   GET /manga/{id}/feed?groups[]=  -> 400 "property groups is not defined"
 *   GET /manga?includedGroups[]=    -> 400 not defined
 *   GET /chapter?groups[]=<uuid>    -> still works
 *   GET /group?name=<string>        -> works ONLY as a plain string; the
 *                                      `name[]=` array form returns 400.
 *
 * So "which scanlators cover this title" is answered by fetching the feed once
 * with includes[]=scanlation_group and bucketing client-side.
 *
 * Image URLs are built as:
 *   {baseUrl}/{quality}/{chapter.hash}/{filename}
 * using the `hash` field, NOT the chapter id. Using the chapter id 404s on
 * every page - that was the bug in the previous version of this file.
 */

import {
  ChapterQuery,
  SearchHit,
  ScanlationSource,
  SourceChapter,
  SourcePage,
  SourceSeries,
} from './types';
import { politeFetch, politeJson, USER_AGENT } from './http';

const API = 'https://api.mangadex.org';
const ATHOME_REPORT = 'https://api.mangadex.network/report';
const BUCKET = 'api.mangadex.org';

/** MangaDex rejects offset+size > 10000 and caps most collections at 100. */
const MAX_PAGE_SIZE = 100;

interface MdRelationship {
  id: string;
  type: string;
  attributes?: {
    name?: string;
    fileName?: string;
    official?: boolean;
    locked?: boolean;
  };
}

interface MdEntity<T> {
  id: string;
  attributes: T;
  relationships?: MdRelationship[];
}

interface MdMangaAttributes {
  title: Record<string, string>;
  description?: Record<string, string>;
  tags?: Array<{ attributes: { name?: Record<string, string>; group?: string } }>;
  status?: string | null;
  year?: number | null;
}

interface MdChapterAttributes {
  chapter: string | null;
  volume: string | null;
  title: string | null;
  translatedLanguage: string | null;
  publishAt: string;
  createdAt: string;
  pages: number;
  externalUrl: string | null;
}

interface MdCollection<T> {
  data: Array<MdEntity<T>>;
  limit: number;
  offset: number;
  total: number;
}

interface MdEntityResponse<T> {
  data: MdEntity<T>;
}

interface MdAtHome {
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
    dataSaver: string[];
  };
}

function firstValue(record?: Record<string, string>): string | undefined {
  if (!record) return undefined;
  return record.en || Object.values(record)[0];
}

function relationship(entity: { relationships?: MdRelationship[] }, type: string) {
  return entity.relationships?.find(rel => rel.type === type);
}

function toStatus(status?: string | null): SourceSeries['status'] {
  if (status === 'completed') return 'completed';
  if (status === 'hiatus') return 'hiatus';
  return 'ongoing';
}

function toNumber(value: string | null, fallback: number): number {
  const parsed = value == null ? NaN : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildUrl(base: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

function coverOf(manga: { id: string; relationships?: MdRelationship[] }): string | undefined {
  const fileName = relationship(manga, 'cover_art')?.attributes?.fileName;
  if (!fileName) return undefined;
  return `https://uploads.mangadex.org/covers/${manga.id}/${fileName}`;
}

export const mangadexSource: ScanlationSource = {
  id: 'mangadex',
  label: 'MangaDex',
  legal: true,
  // MangaDex's acceptable-use policy requires crediting MangaDex and every
  // scanlation group, honouring group removal requests, and running no ads or
  // paid access on top of their data.
  enabled: process.env.MANGADEX_ENABLED !== 'false',

  async search(query: string): Promise<SearchHit[]> {
    const params = new URLSearchParams({
      title: query,
      limit: '20',
      // Only surface titles we can actually read in English.
      'availableTranslatedLanguage[]': 'en',
    });
    // Must be repeated as includes[] - a comma-joined `includes` string is
    // rejected with "String value found, but an array is required".
    params.append('includes[]', 'cover_art');

    const data = await politeJson<MdCollection<MdMangaAttributes>>(
      buildUrl(`${API}/manga`, params),
      { bucket: BUCKET }
    );

    return (data.data || []).map(manga => ({
      externalId: manga.id,
      title: firstValue(manga.attributes.title) || 'Untitled',
      cover: coverOf(manga) ?? null,
    }));
  },

  async getSeries(externalId: string): Promise<SourceSeries | null> {
    const params = new URLSearchParams();
    for (const include of ['cover_art', 'author', 'artist']) params.append('includes[]', include);

    const response = await politeFetch(buildUrl(`${API}/manga/${externalId}`, params), {
      bucket: BUCKET,
    });
    const data = (await response.json()) as MdEntityResponse<MdMangaAttributes>;
    if (!data?.data) return null;

    const manga = data.data;
    const title = firstValue(manga.attributes.title) || 'Untitled';
    const cover = coverOf(manga);

    // MangaDex groups every tag (`genre` / `theme` / `format` / `content`).
    // Genres are the primary list shown inline; everything else is the longer
    // tail the UI tucks behind a "More tags" toggle. Cap the combined list so a
    // tag-heavy title can't grow it without bound.
    const genres: string[] = [];
    const extraTags: string[] = [];
    for (const tag of manga.attributes.tags || []) {
      if (genres.length + extraTags.length >= 12) break;
      const name = firstValue(tag.attributes?.name);
      if (!name) continue;
      (tag.attributes?.group === 'genre' ? genres : extraTags).push(name);
    }

    return {
      externalId: manga.id,
      title,
      cover: cover || `https://placehold.co/300x450/1e2630/ffffff?text=${encodeURIComponent(title)}`,
      description: firstValue(manga.attributes.description) || '',
      tags: genres,
      extraTags,
      status: toStatus(manga.attributes.status),
      author: relationship(manga, 'author')?.attributes?.name ?? null,
    };
  },

  async getChapters(externalId: string, query: ChapterQuery = {}): Promise<SourceChapter[]> {
    const languages = query.languages?.length ? query.languages : ['en'];
    const collected: SourceChapter[] = [];

    // /manga/{id}/feed no longer accepts a groups[] filter (400: "property
    // groups is not defined"), so pull the language-filtered feed with the
    // group expanded and narrow afterwards.
    for (let offset = 0; ; offset += MAX_PAGE_SIZE) {
      const params = new URLSearchParams({ limit: String(MAX_PAGE_SIZE), offset: String(offset) });
      for (const language of languages) params.append('translatedLanguage[]', language);
      params.append('includes[]', 'scanlation_group');
      params.set('order[chapter]', 'asc');

      const data = await politeJson<MdCollection<MdChapterAttributes>>(
        buildUrl(`${API}/manga/${externalId}/feed`, params),
        { bucket: BUCKET }
      );

      for (const item of data.data || []) {
        const group = relationship(item, 'scanlation_group');
        collected.push({
          externalId: item.id,
          number: toNumber(item.attributes.chapter, collected.length + 1),
          volume: item.attributes.volume ? toNumber(item.attributes.volume, 0) : null,
          title: item.attributes.title || null,
          groupName: group?.attributes?.name ?? null,
          groupId: group?.id ?? null,
          // Official publisher groups (Tapas, etc.) are how "straight from the
          // author/licensor" chapters show up on MangaDex.
          official: Boolean(group?.attributes?.official),
          language: item.attributes.translatedLanguage || languages[0],
          pageCount: item.attributes.pages || 0,
          publishedAt: item.attributes.publishAt || item.attributes.createdAt,
          externalUrl: item.attributes.externalUrl || null,
        });
      }

      const total = data.total ?? 0;
      if (!data.data?.length) break;
      if (offset + MAX_PAGE_SIZE >= total) break;
      if (query.limit && collected.length >= query.limit) break;
    }

    const wantedGroups = query.groupIds;
    const filtered = wantedGroups?.length
      ? collected.filter(c => c.groupId && wantedGroups.includes(c.groupId))
      : collected;

    return query.limit ? filtered.slice(0, query.limit) : filtered;
  },

  async getPages(
    chapter: SourceChapter,
    quality: 'data' | 'data-saver' = 'data'
  ): Promise<SourcePage[]> {
    // Link-only chapters point at the official reader and have no files here.
    if (chapter.externalUrl) return [];

    const data = await politeJson<MdAtHome>(`${API}/at-home/server/${chapter.externalId}`, {
      bucket: BUCKET,
    });

    const baseUrl = data.baseUrl;
    const hash = data.chapter?.hash ?? '';
    const filenames = (quality === 'data-saver' ? data.chapter?.dataSaver : data.chapter?.data) || [];
    const savers = data.chapter?.dataSaver || [];

    // Volunteer @Home nodes send no CORS headers and require health reports.
    // First-party hosts already containing mangadex.org do not.
    const requiresReport = !baseUrl.includes('mangadex.org');

    return filenames.map((filename, index) => ({
      index,
      // {baseUrl}/{quality}/{hash}/{filename} - the path segment must follow the
      // requested quality, and it is the hash, never the chapter UUID. Hardcoding
      // /data/ here 404s every data-saver page, because saver filenames live
      // under /data-saver/.
      url: `${baseUrl}/${quality}/${hash}/${filename}`,
      saverUrl: savers[index] ? `${baseUrl}/data-saver/${hash}/${savers[index]}` : undefined,
      requiresReport,
    }));
  },
};

/**
 * MangaDex requires that every image fetched from a non-first-party @Home node
 * is reported back (success or failure) so node health can be tracked.
 * Never let a failed report break reading.
 */
export async function reportAtHome(input: {
  url: string;
  success: boolean;
  bytes: number;
  durationMs: number;
  cached: boolean;
}): Promise<void> {
  try {
    await fetch(ATHOME_REPORT, {
      method: 'POST',
      // The docs are explicit that the content type must be exactly this.
      headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify({
        url: input.url,
        success: input.success,
        bytes: input.bytes,
        duration: Math.round(input.durationMs),
        cached: input.cached,
      }),
    });
  } catch {
    // Ignore - reporting is best-effort telemetry.
  }
}

export interface GroupSummary {
  groupId: string | null;
  groupName: string;
  official: boolean;
  chapters: number;
}

/**
 * Which scanlators cover a title, and how many chapters each one has.
 * This is the replacement for the removed GET /manga/{id}/group route.
 */
export async function listGroupsForSeries(externalId: string): Promise<GroupSummary[]> {
  const chapters = await mangadexSource.getChapters(externalId);
  const counts = new Map<string, GroupSummary>();

  for (const chapter of chapters) {
    const key = chapter.groupId || chapter.groupName || 'unknown';
    const existing = counts.get(key);
    if (existing) {
      existing.chapters += 1;
      existing.official = existing.official || Boolean(chapter.official);
      continue;
    }
    counts.set(key, {
      groupId: chapter.groupId ?? null,
      groupName: chapter.groupName || 'Unknown',
      official: Boolean(chapter.official),
      chapters: 1,
    });
  }

  return Array.from(counts.values()).sort((a, b) => b.chapters - a.chapters);
}

export interface GroupLookup {
  id: string;
  name: string;
  locked: boolean;
  official: boolean;
}

/**
 * How many chapters a group actually has available. This uses
 * GET /chapter?groups[]=<uuid>, which is the one group-filtered endpoint that
 * still exists. A locked group with 0 chapters means its translations are not
 * readable through MangaDex at all (true of some publisher-locked groups).
 */
export async function countChaptersForGroup(groupId: string): Promise<number> {
  const params = new URLSearchParams({ limit: '1' });
  params.append('groups[]', groupId);
  const data = await politeJson<Pick<MdCollection<never>, 'total'>>(
    buildUrl(`${API}/chapter`, params),
    { bucket: BUCKET }
  );
  return data.total ?? 0;
}

/**
 * Resolve scanlator names to group UUIDs. Note `name` must be sent as a plain
 * string - the `name[]=` array form is rejected with a validation error.
 */
export async function findGroupByName(name: string): Promise<GroupLookup[]> {
  const params = new URLSearchParams({ name });
  const data = await politeJson<MdCollection<{ name: string; locked?: boolean; official?: boolean }>>(
    buildUrl(`${API}/group`, params),
    { bucket: BUCKET }
  );

  return (data.data || []).map(group => ({
    id: group.id,
    name: group.attributes.name,
    locked: Boolean(group.attributes.locked),
    official: Boolean(group.attributes.official),
  }));
}

