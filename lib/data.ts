import { Series } from './types';

function makePages(count: number, seed: string) {
  return Array.from({ length: count }).map((_, i) => ({
    index: i,
    image: `https://placehold.co/900x1400/1e2630/ffffff?text=${seed}+${i+1}`
  }));
}

/**
 * SERIES DATA
 * 
 * You can populate this in two ways:
 * 
 * 1. PLACEHOLDER MODE (current):
 *    - Uses placehold.co for cover & page images
 *    - Good for demo / testing
 * 
 * 2. REAL DATA MODE:
 *    - Run: npx ts-node scripts/import-mangadex.ts "Series Title"
 *    - Copy the JSON output
 *    - Replace placeholder entries below
 * 
 * Example from MangaDex (Damn Reincarnation):
 * 
 * {
 *   "id": "8d1ca3d7-bf33-4a7f-88a5-f4dbb9e0b58a",
 *   "title": "Damn Reincarnation",
 *   "cover": "https://uploads.mangadex.org/covers/...",
 *   "description": "A legendary swordmaster is reborn in a new world...",
 *   "tags": ["action", "fantasy", "manhwa"],
 *   "status": "ongoing",
 *   "chapters": [ ... ],
 *   "updatedAt": "2025-11-25T..."
 * }
 */

export const SERIES: Series[] = [
  {
    id: 'damn-reincarnation',
    title: 'Damn Reincarnation',
    cover: 'https://placehold.co/300x450/1e2630/ffffff?text=Damn+Reincarnation',
    description: 'A legendary hero\'s soul reincarnates into a new world. Experience an epic tale of power, magic, and destiny. (Demo: using placeholder images)',
    tags: ['action', 'fantasy', 'manhwa', 'reincarnation'],
    status: 'ongoing',
    chapters: [
      {
        id: 'damn-reincarnation-1',
        number: 1,
        title: 'The Return',
        pages: makePages(15, 'DamnReincarnation-Ch1'),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'damn-reincarnation-2',
        number: 2,
        title: 'Awakening Power',
        pages: makePages(14, 'DamnReincarnation-Ch2'),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'damn-reincarnation-3',
        number: 3,
        title: 'The Path Forward',
        pages: makePages(16, 'DamnReincarnation-Ch3'),
        updatedAt: new Date().toISOString()
      }
    ],
    updatedAt: new Date().toISOString()
  },
  {
    id: 'shadow-blade',
    title: 'Shadow Blade Chronicle',
    cover: 'https://placehold.co/300x450/1e2630/ffffff?text=Shadow+Blade',
    description: 'An exiled warrior returns to a fractured realm to reclaim lost honor and uncover ancient power.',
    tags: ['action', 'fantasy'],
    status: 'ongoing',
    chapters: [
      {
        id: 'shadow-blade-1',
        number: 1,
        title: 'Arrival',
        pages: makePages(12, 'ShadowBlade-1'),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'shadow-blade-2',
        number: 2,
        title: 'Echoes',
        pages: makePages(10, 'ShadowBlade-2'),
        updatedAt: new Date().toISOString()
      }
    ],
    updatedAt: new Date().toISOString()
  },
  {
    id: 'crimson-academy',
    title: 'Crimson Academy',
    cover: 'https://placehold.co/300x450/1e2630/ffffff?text=Crimson+Academy',
    description: 'A scholar with forbidden magic enrolls in an elite academy while hiding a dangerous secret.',
    tags: ['school', 'mystery'],
    status: 'ongoing',
    chapters: [
      {
        id: 'crimson-academy-1',
        number: 1,
        title: 'Enrollment',
        pages: makePages(11, 'CrimsonAcademy-1'),
        updatedAt: new Date().toISOString()
      }
    ],
    updatedAt: new Date().toISOString()
  }
];

export function getAllSeries(): Series[] {
  return SERIES;
}

export function getSeries(id: string): Series | undefined {
  return SERIES.find(s => s.id === id);
}

export function getChapter(seriesId: string, chapterId: string) {
  const series = getSeries(seriesId);
  return series?.chapters.find(c => c.id === chapterId);
}
