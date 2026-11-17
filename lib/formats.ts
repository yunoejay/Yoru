/**
 * Format / origin taxonomy for the catalog.
 *
 * These are different comic traditions, not synonyms: manhwa is Korean, manhua
 * is Chinese, and manga is Japanese. MangaBaka (the metadata behind Atsumaru)
 * reports the origin in its `type` field; older imports hardcoded every title
 * as "manga", which is wrong for most of this catalog.
 */

export const SERIES_FORMATS = ['manhwa', 'manhua', 'manga', 'oel'] as const;

export type SeriesFormat = (typeof SERIES_FORMATS)[number];

export interface SeriesFormatInfo {
  tag: SeriesFormat;
  /** Display name, e.g. "Manhwa". */
  label: string;
  /** Where the tradition comes from, e.g. "Korean". */
  origin: string;
}

const FORMAT_INFO: Record<SeriesFormat, Omit<SeriesFormatInfo, 'tag'>> = {
  manhwa: { label: 'Manhwa', origin: 'Korean' },
  manhua: { label: 'Manhua', origin: 'Chinese' },
  manga: { label: 'Manga', origin: 'Japanese' },
  oel: { label: 'OEL', origin: 'English' },
};

/**
 * Normalise a raw source label to a format tag.
 *
 * "Manwha" is MangaBaka's own misspelling of manhwa; OEL (original
 * English-language) keeps its own label rather than being folded into manga.
 */
export function normalizeSeriesFormat(value: string | null | undefined): SeriesFormat | null {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'manhwa':
    case 'manwha':
      return 'manhwa';
    case 'manhua':
      return 'manhua';
    case 'manga':
      return 'manga';
    case 'oel':
      return 'oel';
    default:
      return null;
  }
}

/** True when a tag names a format rather than a genre. */
export function isFormatTag(tag: string): boolean {
  return normalizeSeriesFormat(tag) !== null;
}

/** The format a series belongs to, derived from its stored tags. */
export function seriesFormatInfo(tags: readonly string[]): SeriesFormatInfo | null {
  for (const tag of tags) {
    const format = normalizeSeriesFormat(tag);
    if (format) return { tag: format, ...FORMAT_INFO[format] };
  }
  return null;
}
