/**
 * GET /api/chapter/[chapterId]/pages
 *
 * Resolves a stored chapter into a page list at read time. This exists because
 * upstream page URLs are short-lived (MangaDex guarantees ~15 minutes) and are
 * not hotlink-safe, so they can never be stored or handed to the browser
 * directly. What we return are same-origin proxy URLs instead.
 *
 * Query params:
 *   quality=data | data-saver   (default: data)
 *   fresh=1                     bypass the disposable warm cache
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { findResolvableChapter } from '@/lib/content';
import { requireSource } from '@/lib/sources';
import { encodeProxySrc } from '@/lib/image-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Stay comfortably inside the ~15 minute guarantee. */
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CachedPages {
  quality: 'data' | 'data-saver';
  expiresAt: string;
  pages: string[];
  scanlator: string | null;
  requiresReport: boolean;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ chapterId: string }> }
) {
  const { chapterId } = await context.params;
  const url = new URL(request.url);
  const quality = url.searchParams.get('quality') === 'data-saver' ? 'data-saver' : 'data';
  const forceFresh = url.searchParams.get('fresh') === '1';

  const resolved = await findResolvableChapter(chapterId);
  if (!resolved) {
    return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
  }

  // Bundled demo chapters ship their own placeholder images, which are safe to
  // hotlink and need no proxying.
  if (!resolved.sourceId) {
    return NextResponse.json({
      chapterId,
      source: null,
      demo: true,
      quality: 'data',
      scanlator: null,
      total: resolved.inlinePages.length,
      pages: resolved.inlinePages,
    });
  }

  const source = requireSource(resolved.sourceId);

  let cached: CachedPages | null = null;
  const row = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { pageCache: true, pageCacheExpires: true },
  });
  if (!forceFresh && row?.pageCache && row.pageCacheExpires && row.pageCacheExpires > new Date()) {
    cached = row.pageCache as unknown as CachedPages;
    if (cached.quality !== quality) cached = null;
  }

  if (!cached) {
    const pages = await source.getPages(resolved.chapter!, quality);
    if (!pages.length) {
      return NextResponse.json(
        {
          error: 'No pages available for this chapter',
          linkOutUrl: resolved.chapter?.externalUrl ?? null,
        },
        { status: 502 }
      );
    }

    cached = {
      quality,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      pages: pages.map(page => encodeProxySrc(page.url, Boolean(page.requiresReport))),
      requiresReport: pages.some(page => page.requiresReport),
      scanlator: resolved.chapter?.groupName
        ? `${resolved.chapter.groupName}${resolved.chapter.official ? ' (official)' : ''}`
        : null,
    };

    // Best-effort: a cache write must never break reading.
    //
    // The resolved count is written back as well: some sources omit `page_count`
    // for a few chapters, so the imported row claims 0 pages and the series page
    // shows no badge even though the strip resolves fine. Link-only chapters
    // cannot reach this line (they 502 above), so genuine 0-page link-outs keep
    // their 0 and still render the publisher link.
    await prisma.chapter
      .update({
        where: { id: chapterId },
        data: {
          pageCache: cached as object,
          pageCacheExpires: new Date(Date.now() + CACHE_TTL_MS),
          pageCount: pages.length,
        },
      })
      .catch(() => undefined);
  }

  return NextResponse.json({
    chapterId,
    source: source.id,
    demo: false,
    quality: cached.quality,
    scanlator: cached.scanlator,
    // MangaDex's acceptable-use policy requires MangaDex and the scanlation
    // group to be credited wherever chapters are readable.
    attribution: {
      source: source.id === 'mangadex' ? 'MangaDex' : source.label,
      group: cached.scanlator,
    },
    total: cached.pages.length,
    pages: cached.pages,
    expiresAt: cached.expiresAt,
  });
}
