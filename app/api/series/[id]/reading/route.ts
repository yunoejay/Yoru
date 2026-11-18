import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { markSeriesReading } from '@/lib/library';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/series/<id>/reading
 *
 * Called by the client when a chapter opens: it files the series as `reading`
 * (or leaves an active `reading`/`rereading` entry alone), so a title the
 * reader already read elsewhere is shelved as "currently reading" as soon as
 * they open chapter 1 - or any other chapter - here.
 *
 * Idempotent. Anonymous callers get a 401: a status belongs to the account,
 * and guests have no library row to write to.
 */
export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'You must be signed in to track your reading status.' },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'seriesId is required.' }, { status: 400 });
  }

  const result = await markSeriesReading(user.id, id);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, inLibrary: true, status: result.status });
}
