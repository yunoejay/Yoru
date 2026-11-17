import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { parseProfileFields, toPublicProfile } from '@/lib/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/profile
 * The full profile plus the reader's activity counters, for the account page.
 * (`/api/auth/me` deliberately stays lean because the Navbar calls it often.)
 */
export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [user, library, chaptersRead, trackedSeries] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.id } }),
      prisma.libraryEntry.count({ where: { userId: session.id } }),
      prisma.chapterRead.count({ where: { userId: session.id } }),
      prisma.chapterRead.findMany({
        where: { userId: session.id },
        distinct: ['seriesId'],
        select: { seriesId: true },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      user: toPublicProfile(user),
      stats: {
        library,
        chaptersRead,
        seriesTracked: trackedSeries.length,
      },
    });
  } catch (error) {
    console.error('Profile read error:', error);
    return NextResponse.json({ error: 'Could not load your profile.' }, { status: 500 });
  }
}

/**
 * PUT /api/auth/profile
 * Updates the editable profile fields: handle (username), display name, bio,
 * location and website. Email is intentionally read-only here; changing it
 * would need a fresh verification round-trip.
 */
export async function PUT(req: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = parseProfileFields(body);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const fields = parsed.data;
    const usernameTaken = await prisma.user.findFirst({
      where: {
        name: { equals: fields.username, mode: 'insensitive' },
        NOT: { id: session.id },
      },
    });
    if (usernameTaken) {
      return NextResponse.json({ error: 'Username already taken.' }, { status: 409 });
    }

    const user = await prisma.user.update({
      where: { id: session.id },
      data: {
        name: fields.username,
        displayName: fields.displayName,
        bio: fields.bio,
        location: fields.location,
        website: fields.website,
      },
    });

    return NextResponse.json({ ok: true, user: toPublicProfile(user) });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Profile update failed.' }, { status: 500 });
  }
}

