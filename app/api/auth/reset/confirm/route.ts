import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const token = String(body.token || '').trim();
    const password = String(body.password || '');

    if (!email || !token || !password) {
      return NextResponse.json({ error: 'Email, token, and password are required.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid reset token.' }, { status: 400 });
    }

    const record = await prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        token,
        usedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!record || record.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired reset token.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Reset confirm error:', error);
    return NextResponse.json({ error: 'Password reset failed.' }, { status: 500 });
  }
}
