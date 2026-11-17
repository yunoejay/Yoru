import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateResetToken } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });

    const emailResult = await sendPasswordResetEmail(email, token);

    return NextResponse.json({
      ok: true,
      emailSent: emailResult.sent,
      devResetUrl: emailResult.dev ? emailResult.resetUrl : undefined
    });
  } catch (error) {
    console.error('Reset request error:', error);
    return NextResponse.json({ error: 'Reset request failed.' }, { status: 500 });
  }
}
