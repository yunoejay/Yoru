import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifySessionToken } from '@/lib/auth';
import { toPublicProfile } from '@/lib/profile';

export const runtime = 'nodejs';

/**
 * GET /api/auth/me
 * The signed-in user's profile, or `{ user: null }`. The Navbar refreshes this
 * on navigation and on the `yoru:auth-changed` event, so login/logout/profile
 * edits are reflected immediately without a hard reload.
 */
export async function GET(req: Request) {
  try {
    const cookie = req.headers.get('cookie') || '';
    const tokenMatch = cookie.match(/auth_token=([^;]+)/);
    if (!tokenMatch) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const token = tokenMatch[1];
    const payload = verifySessionToken(token);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json({ user: toPublicProfile(user) });
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}

