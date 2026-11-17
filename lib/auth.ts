import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import prisma from './prisma';

/** Name of the session cookie set by the login/register routes. */
export const AUTH_COOKIE = 'auth_token';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  verified: boolean;
}

/**
 * Server-side session lookup for pages/components (as opposed to the
 * client-side `/api/auth/me` fetch used by the Navbar). Reads the JWT from the
 * request cookie store, verifies it, and re-checks that the user still exists.
 * Returns null for anonymous visitors or a stale/invalid token, and never
 * throws, so a database outage degrades to "not logged in" instead of a 500.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;
    if (!token) return null;

    const payload = verifySessionToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      verified: !!user.verified,
    };
  } catch {
    return null;
  }
}

const JWT_SECRET = process.env.AUTH_JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = '7d';

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function createSessionToken(payload: { userId: string; email: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifySessionToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
}

export function generateVerificationCode() {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  return code;
}

export function generateId() {
  return crypto.randomUUID();
}

export function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}
