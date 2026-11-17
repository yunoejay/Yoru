import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createSessionToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }
    if (user.verified) {
      const token = createSessionToken({ userId: user.id, email: user.email });
      const response = NextResponse.json({ ok: true, verified: true });
      response.cookies.set('auth_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      });
      return response;
    }

    const record = await prisma.verificationCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    if (!record || record.code !== code) {
      return NextResponse.json({ error: 'Invalid verification code.' }, { status: 400 });
    }

    if (record.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Verification code expired.' }, { status: 400 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { verified: true } });
    await prisma.verificationCode.deleteMany({ where: { userId: user.id } });

    const token = createSessionToken({ userId: user.id, email: user.email });
    const response = NextResponse.json({ ok: true, verified: true });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ error: 'Verification failed.' }, { status: 500 });
  }
}
