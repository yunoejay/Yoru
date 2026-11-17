/**
 * GET /api/image?src=<base64url>&report=0|1
 *
 * Same-origin proxy for chapter pages. Required because MangaDex serves a bogus
 * image to hotlinkers and sends no CORS for foreign origins, so the browser
 * cannot load upstream URLs directly.
 *
 * Every target is re-validated against the host allowlist in lib/image-proxy.ts
 * before we fetch it, and MangaDex@Home health reports are sent back when the
 * page came from a volunteer node.
 */

import { NextResponse } from 'next/server';
import { politeFetch } from '@/lib/sources/http';
import { reportAtHome } from '@/lib/sources/mangadex';
import { decodeProxySrc } from '@/lib/image-proxy';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = decodeProxySrc(url.searchParams.get('src'), url.searchParams.get('report') === '1');

  if (!target) {
    return NextResponse.json({ error: 'Invalid or disallowed image target' }, { status: 400 });
  }

  const startedAt = Date.now();
  let upstream: Response;

  try {
    upstream = await politeFetch(target.url.toString(), {
      headers: { Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' },
    });
  } catch (error) {
    // A failed fetch still has to be reported, or MangaDex cannot tell the node
    // is broken and will keep handing it to us.
    if (target.requiresReport) {
      await reportAtHome({
        url: target.url.toString(),
        success: false,
        bytes: 0,
        durationMs: Date.now() - startedAt,
        cached: false,
      });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }

  // Buffer so we can report accurate byte counts and timing.
  const buffer = Buffer.from(await upstream.arrayBuffer());
  const durationMs = Date.now() - startedAt;
  const xCache = upstream.headers.get('x-cache') || '';
  const cached = xCache.toUpperCase().startsWith('HIT');

  if (target.requiresReport) {
    await reportAtHome({
      url: target.url.toString(),
      success: upstream.ok,
      bytes: buffer.length,
      durationMs,
      cached,
    });
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: `Upstream returned ${upstream.status}` }, { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') || 'image/jpeg';

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
      // Upstream at-home URLs rotate; the proxy URL itself stays valid, so a
      // short private cache is safe and keeps reloads cheap.
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
      'X-Image-Source': upstream.headers.get('x-cache') ? 'cached-upstream' : 'upstream',
      // Attribution header so the credit requirement is traceable in DevTools.
      'X-Credits': 'MangaDex + contributing scanlation group',
    },
  });
}
