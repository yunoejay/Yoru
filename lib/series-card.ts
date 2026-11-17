import type { SeriesView } from './content';

/**
 * The lightweight shape every list/card UI renders from. Derived from a
 * `SeriesView` but replaces the full `chapters` array with just its length, so
 * server components can project it once and client components can receive a
 * small serializable list instead of every chapter object.
 */
export interface SeriesCardData {
  id: string;
  title: string;
  cover: string;
  description: string;
  tags: string[];
  status: SeriesView['status'];
  chapterCount: number;
  scanlatorLabels: string[];
  author: string | null;
  /** ISO timestamp of the series' last chapter activity. */
  updatedAt: string;
  /**
   * Pre-formatted recency label ("Updated 3d ago").
   *
   * Computed on the server with `formatUpdatedLabel` and serialized to the
   * client. Formatting relative dates during client render would drift from the
   * server HTML whenever the two land on different sides of midnight.
   */
  updatedLabel: string;
  isStaticDemo: boolean;
}

const DAY_MS = 86_400_000;

/**
 * Short, human label for a series' last activity.
 *
 * Accepts an explicit `now` so callers can keep the label deterministic in
 * tests; the card path always uses the server's request time.
 */
export function formatUpdatedLabel(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'Updated recently';

  const elapsed = now.getTime() - then.getTime();
  if (elapsed < DAY_MS) return 'Updated today';

  const days = Math.floor(elapsed / DAY_MS);
  if (days === 1) return 'Updated yesterday';
  if (days < 7) return `Updated ${days}d ago`;
  if (days < 30) return `Updated ${Math.floor(days / 7)}w ago`;

  return `Updated ${then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function toSeriesCardData(series: SeriesView): SeriesCardData {
  return {
    id: series.id,
    title: series.title,
    cover: series.cover,
    description: series.description,
    tags: series.tags,
    status: series.status,
    chapterCount: series.chapters.length,
    scanlatorLabels: series.scanlatorLabels,
    author: series.author?.trim() || null,
    updatedAt: series.updatedAt,
    updatedLabel: formatUpdatedLabel(series.updatedAt),
    isStaticDemo: series.isStaticDemo,
  };
}

export function toSeriesCardDataList(series: SeriesView[]): SeriesCardData[] {
  return series.map(toSeriesCardData);
}
