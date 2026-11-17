export interface ChapterPage {
  index: number;
  image: string;
}

export interface Chapter {
  id: string;
  number: number;
  title?: string;
  pages: ChapterPage[];
  updatedAt: string;
}

export interface Series {
  id: string;
  title: string;
  cover: string;
  description: string;
  tags: string[];
  /** Longer tail of tags shown behind a "More tags" toggle. */
  extraTags?: string[];
  status: 'ongoing' | 'completed' | 'hiatus';
  chapters: Chapter[];
  updatedAt: string;
}

/**
 * One row in the navbar search dropdown, returned by GET /api/search.
 *
 * `id` is the routing id (`Series.slug` when the series has one, otherwise its
 * uuid), so the client can link straight to /series/[id] without knowing which
 * of the two it received. The cover has already been run through the image
 * proxy, exactly like `SeriesCardData.cover`.
 */
export interface SeriesSearchHit {
  id: string;
  title: string;
  cover: string;
  author: string | null;
  chapterCount: number;
  tags: string[];
  status: string;
  /** True only when the database was unreachable and demo data answered. */
  isStaticDemo: boolean;
}
