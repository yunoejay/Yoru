import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { removeLibraryEntry } from '@/lib/library';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ seriesId: string }>;
}

/** DELETE /api/library/<seriesId> — removes a series from the reader's bookmarks. */
export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 });
  }

  const { seriesId } = await context.params;
  if (!seriesId) {
    return NextResponse.json({ error: 'seriesId is required.' }, { status: 400 });
  }

  const result = await removeLibraryEntry(user.id, seriesId);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, inLibrary: false, status: null });
}
