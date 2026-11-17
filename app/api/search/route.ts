import { NextResponse } from 'next/server';
import {
  clampSearchLimit,
  normalizeSearchQuery,
  searchSeries,
} from '@/lib/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/search?q=<query>&limit=<1-10>
 *
 * Live suggestions for the navbar search box. Returns the slim
 * `SeriesSearchHit` shape so the dropdown can render covers and chapter counts
 * without loading a series' chapter rows. An empty query is answered without
 * touching the database.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = normalizeSearchQuery(params.get('q'));

  if (!query) {
    return NextResponse.json({ results: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const results = await searchSeries(query, clampSearchLimit(params.get('limit')));

  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } });
}
