import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getLibraryEntry, setLibraryStatus } from '@/lib/library';
import { isLibraryStatus } from '@/lib/library-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/library?seriesId=<publicId>
 * Reports the signed-in reader's status for a series so the series-page picker
 * can render its initial state. Anonymous callers get `inLibrary: false`.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ signedIn: false, inLibrary: false, status: null });
  }

  const seriesId = new URL(request.url).searchParams.get('seriesId');
  if (!seriesId) {
    return NextResponse.json({ signedIn: true, inLibrary: false, status: null });
  }

  const entry = await getLibraryEntry(user.id, seriesId);
  return NextResponse.json({
    signedIn: true,
    inLibrary: Boolean(entry),
    status: entry?.status ?? null,
  });
}

/**
 * PUT /api/library { seriesId, status }
 * Adds the series to the reader's bookmarks or moves it to another status.
 * Idempotent (upsert), so a retry or two tabs cannot create duplicates.
 */
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'You must be signed in to use bookmarks.' },
      { status: 401 },
    );
  }

  let seriesId = '';
  let status: unknown;
  try {
    const body = await request.json();
    seriesId = String(body?.seriesId || '');
    status = body?.status;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!seriesId) {
    return NextResponse.json({ error: 'seriesId is required.' }, { status: 400 });
  }
  if (!isLibraryStatus(status)) {
    return NextResponse.json({ error: 'Unknown reading status.' }, { status: 400 });
  }

  const result = await setLibraryStatus(user.id, seriesId, status);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, inLibrary: true, status: result.status });
}
