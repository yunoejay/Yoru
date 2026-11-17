/**
 * Shared contract for every content source (MangaDex, official publisher
 * groups, API aggregators).
 *
 * Two rules from the MangaDex API docs drove this design (verified against the
 * live API and docs on 2026-09-10):
 *
 * 1. `at-home` base URLs expire. Docs guarantee only 15 minutes of validity, so
 *    page URLs are NEVER persisted anywhere. We store chapter *identity* and
 *    resolve pages on every read.
 *    https://gitlab.com/mangadex-pub/mangadex-api-docs/-/raw/main/04-chapter/retrieving-chapter.md
 * 2. Hotlinking is blocked - MangaDex deliberately serves the "wrong response"
 *    image to foreign origins and sends no CORS for other sites. Pages must be
 *    proxied through our own server.
 */

export type SourceId = 'mangadex' | 'atsumaru';

export interface SourcePage {
  /** Zero-based reading order. */
  index: number;
  /** Upstream URL. Must never reach the browser directly - proxy it. */
  url: string;
  /** Optional compressed variant (MangaDex `data-saver`). */
  saverUrl?: string;
  /**
   * True when the source expects a success/failure report for each image
   * (MangaDex@Home nodes whose host does not contain `mangadex.org`).
   */
  requiresReport?: boolean;
}

export interface SourceChapter {
  /** ID as far as *this source* is concerned (MangaDex chapter UUID, etc). */
  externalId: string;
  number: number;
  volume?: number | null;
  title?: string | null;
  /** The scanlator that produced this specific chapter. */
  groupName?: string | null;
  groupId?: string | null;
  /** True when the group is a licensed/official publisher (e.g. Tapas). */
  official?: boolean;
  /** ISO-639-1 code, e.g. "en". */
  language: string;
  pageCount: number;
  /** ISO timestamp of publication. */
  publishedAt: string;
  /**
   * Set when the chapter is only a pointer at the official reading site rather
   * than images hosted on the source. Such chapters cannot be proxied.
   */
  externalUrl?: string | null;
}

export interface SourceSeries {
  externalId: string;
  title: string;
  cover: string;
  description: string;
  /** Primary genres shown inline. */
  tags: string[];
  /**
   * Secondary tags (themes / formats / content warnings). Kept separate from
   * `tags` because a manhwa's theme list can be long, and the UI tucks these
   * behind a "More tags" toggle. Omit when the source has no such split.
   */
  extraTags?: string[];
  status: 'ongoing' | 'completed' | 'hiatus';
  author?: string | null;
}

export interface SearchHit {
  externalId: string;
  title: string;
  cover?: string | null;
}

export interface ChapterQuery {
  /** ISO language codes to keep. Defaults to the source's default. */
  languages?: string[];
  /** Keep only chapters translated by these source-side group IDs. */
  groupIds?: string[];
  /** Safety cap on chapters returned. */
  limit?: number;
}

export interface SourceMeta {
  id: SourceId;
  label: string;
  /**
   * True when the source is a sanctioned API / official publisher channel.
   * False means scraping, which carries ToS and copyright exposure and must
   * never be enabled by default.
   */
  legal: boolean;
  /** Disabled sources load but refuse requests. */
  enabled: boolean;
}

export interface ScanlationSource extends SourceMeta {
  search(query: string): Promise<SearchHit[]>;
  getSeries(externalId: string): Promise<SourceSeries | null>;
  getChapters(externalId: string, query?: ChapterQuery): Promise<SourceChapter[]>;
  /** Resolve page URLs for a chapter. Always call at read time. */
  getPages(chapter: SourceChapter, quality?: 'data' | 'data-saver'): Promise<SourcePage[]>;
}

/** Thrown by disabled/illegal sources so callers can degrade cleanly. */
export class SourceDisabledError extends Error {
  constructor(sourceId: string, reason: string) {
    super(`Source "${sourceId}" is disabled: ${reason}`);
    this.name = 'SourceDisabledError';
  }
}
