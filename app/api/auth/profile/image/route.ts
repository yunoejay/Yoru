import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { toPublicProfile } from '@/lib/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Profile banner / avatar upload.
 *
 * Files are written to `public/uploads/profiles/` and the URL is stored on the
 * user row. That is the right trade-off for a self-hosted, single-instance
 * app: no extra service, and `next start` serves the file from disk. On a
 * serverless host the filesystem is ephemeral, so swap this for S3/R2/uploads
 * before deploying there.
 *
 * The declared Content-Type is ignored; the file's magic bytes decide whether
 * it is really a PNG/JPEG/WebP/GIF, and the extension is derived from that. So
 * an "image" that is actually HTML can never be stored.
 */

type Kind = 'avatar' | 'banner';

const MAX_BYTES: Record<Kind, number> = {
  avatar: 2 * 1024 * 1024,
  banner: 3 * 1024 * 1024,
};

const UPLOAD_URL_PREFIX = '/uploads/profiles/';

function isKind(value: string): value is Kind {
  return value === 'avatar' || value === 'banner';
}

function uploadDir(): string {
  return path.join(process.cwd(), 'public', 'uploads', 'profiles');
}

/** Sniff the image format from its signature bytes. */
function detectImage(buffer: Buffer): string | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  const gifHeader = buffer.toString('ascii', 0, 6);
  if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
    return 'gif';
  }
  return null;
}

/** Only ever delete files this route created, inside the uploads directory. */
async function removeStoredFile(url: string | null): Promise<void> {
  if (!url || !url.startsWith(UPLOAD_URL_PREFIX)) return;
  const name = url.slice(UPLOAD_URL_PREFIX.length);
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return;
  await fs.unlink(path.join(uploadDir(), name)).catch(() => undefined);
}

async function bodyFromRequest(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/profile/image  (multipart/form-data: kind=avatar|banner, file)
 * Replaces the chosen image and returns the updated profile.
 */
export async function POST(request: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await bodyFromRequest(request);
  if (!form) {
    return NextResponse.json({ error: 'Expected a multipart form upload.' }, { status: 400 });
  }

  const kind = String(form.get('kind') || 'avatar');
  if (!isKind(kind)) {
    return NextResponse.json({ error: 'kind must be "avatar" or "banner".' }, { status: 400 });
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No image was uploaded.' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'That file is empty.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES[kind]) {
    const mb = MAX_BYTES[kind] / (1024 * 1024);
    return NextResponse.json(
      { error: `${kind === 'avatar' ? 'Avatar' : 'Banner'} must be ${mb} MB or smaller.` },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = detectImage(buffer);
  if (!extension) {
    return NextResponse.json(
      { error: 'Upload a PNG, JPEG, WebP, or GIF image.' },
      { status: 415 },
    );
  }

  const previous = await prisma.user.findUnique({
    where: { id: session.id },
    select: { avatarUrl: true, bannerUrl: true },
  });
  if (!previous) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const filename = `${session.id}-${kind}-${Date.now()}.${extension}`;
  const directory = uploadDir();
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, filename), buffer);

  const url = `${UPLOAD_URL_PREFIX}${filename}`;
  try {
    const user = await prisma.user.update({
      where: { id: session.id },
      data: kind === 'avatar' ? { avatarUrl: url } : { bannerUrl: url },
    });
    await removeStoredFile(kind === 'avatar' ? previous.avatarUrl : previous.bannerUrl);
    return NextResponse.json({ ok: true, user: toPublicProfile(user) });
  } catch (error) {
    // Do not leave an orphaned file behind if the row update failed.
    await removeStoredFile(url);
    console.error('Profile image update error:', error);
    return NextResponse.json({ error: 'Could not save that image.' }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/profile/image?kind=avatar|banner
 * Clears the image and removes the stored file.
 */
export async function DELETE(request: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const kind = new URL(request.url).searchParams.get('kind') || 'avatar';
  if (!isKind(kind)) {
    return NextResponse.json({ error: 'kind must be "avatar" or "banner".' }, { status: 400 });
  }

  const previous = await prisma.user.findUnique({
    where: { id: session.id },
    select: { avatarUrl: true, bannerUrl: true },
  });
  if (!previous) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.update({
      where: { id: session.id },
      data: kind === 'avatar' ? { avatarUrl: null } : { bannerUrl: null },
    });
    await removeStoredFile(kind === 'avatar' ? previous.avatarUrl : previous.bannerUrl);
    return NextResponse.json({ ok: true, user: toPublicProfile(user) });
  } catch (error) {
    console.error('Profile image removal error:', error);
    return NextResponse.json({ error: 'Could not remove that image.' }, { status: 500 });
  }
}
