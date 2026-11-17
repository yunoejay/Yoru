import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateVerificationCode, hashPassword } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';

export const runtime = 'nodejs';

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const username = String(body.username || '').trim();

    if (!email || !password || !username) {
      return NextResponse.json({ error: 'Username, email, and password are required.' }, { status: 400 });
    }
    if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3–30 characters using only letters, numbers, and underscores.' },
        { status: 400 }
      );
    }
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered.' }, { status: 409 });
    }

    const usernameTaken = await prisma.user.findFirst({
      where: { name: { equals: username, mode: 'insensitive' } }
    });
    if (usernameTaken) {
      return NextResponse.json({ error: 'Username already taken.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        name: username,
        passwordHash,
        verified: false
      }
    });

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.verificationCode.deleteMany({ where: { userId: user.id } });
    await prisma.verificationCode.create({
      data: {
        userId: user.id,
        code,
        expiresAt
      }
    });

    const emailResult = await sendVerificationEmail(email, code);

    return NextResponse.json({
      ok: true,
      emailSent: emailResult.sent,
      devCode: emailResult.dev ? code : undefined
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 });
  }
}
