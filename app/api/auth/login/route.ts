import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createSessionToken, verifyPassword } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // The form sends `username`, but accept an email address in the same field:
    // typing the email used to always fail with "Invalid credentials." because
    // this route only ever matched the handle.
    const identifier = String(body.username || body.email || '').trim();
    const password = String(body.password || '');

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Username (or email) and password are required.' },
        { status: 400 }
      );
    }

    // `User.name` is the handle shown as @username, `User.email` is the address
    // collected at registration; either identifies the account. Registration
    // keeps the handle case-insensitively unique, so that lookup is unambiguous.
    const user = identifier.includes('@')
      ? await prisma.user.findUnique({ where: { email: identifier.toLowerCase() } })
      : await prisma.user.findFirst({
          where: { name: { equals: identifier, mode: 'insensitive' } },
        });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    if (!user.verified) {
      return NextResponse.json({ error: 'Please verify your email first.' }, { status: 403 });
    }

    const token = createSessionToken({ userId: user.id, email: user.email });
    const response = NextResponse.json({ ok: true });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed.' }, { status: 500 });
  }
}
