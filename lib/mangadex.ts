/**
 * @deprecated This file used to contain a hand-rolled MangaDex client with two
 * real bugs in it:
 *
 *   1. Page URLs were built as `${baseUrl}/data/${chapter.id}/${page}`. The
 *      correct segment is `chapter.hash`, so every generated URL 404'd.
 *   2. Chapters were fetched with no `translatedLanguage[]` filter, so feeds
 *      returned every language mixed together (verified: Italian + Turkish
 *      chapters appearing in an English reader).
 *
 * It also sent no User-Agent (MangaDex requires a real one) and never reported
 * MangaDex@Home image results (required for volunteer nodes).
 *
 * All of that now lives in lib/sources/mangadex.ts behind the ScanlationSource
 * interface. This shim only keeps old imports resolving.
 */

export {
  mangadexSource,
  reportAtHome,
  listGroupsForSeries,
  findGroupByName,
} from './sources/mangadex';

export type { GroupSummary, GroupLookup } from './sources/mangadex';

