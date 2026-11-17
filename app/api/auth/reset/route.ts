import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
	return NextResponse.json({ error: 'Use /api/auth/reset/request or /api/auth/reset/confirm' }, { status: 400 });
}
