import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listReadChapterNumbers, setChapterRead, type ReadMutation } from '@/lib/read-progress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/series/<id>/read-progress
 * Every chapter number the reader has marked read. Signed-out readers get an
 * empty list: their progress lives in this browser's localStorage, which the
 * server cannot and does not need to see.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ numbers: [], signedIn: false });
  }
  const numbers = await listReadChapterNumbers(user.id, id);
  return NextResponse.json({ numbers, signedIn: true });
}

/**
 * PUT /api/series/<id>/read-progress { number, read }
 * Marks one chapter number read (`read: true`) or unread (`read: false`).
 * 401 for guests so the client keeps their progress in localStorage instead.
 */
export async function PUT(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to sync reading progress across devices.', signedIn: false },
      { status: 401 },
    );
  }

  let number = Number.NaN;
  let read = true;
  try {
    const body = await request.json();
    number = Number(body?.number);
    read = body?.read !== false;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!Number.isFinite(number) || number < 0) {
    return NextResponse.json({ error: 'number must be a non-negative chapter number.' }, { status: 400 });
  }

  const { id } = await context.params;
  const result: ReadMutation = await setChapterRead(user.id, id, number, read);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ number: result.number, read: result.read, signedIn: true });
}
