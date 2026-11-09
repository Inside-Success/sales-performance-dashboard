import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

// Owner-only, read-only proof that a connected lab is using its intended store.
// Never available on production and never returns connection credentials.
export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.COACHING_LAB_CONNECTED !== 'true') return new NextResponse(null, { status: 404 });
  const session = await auth();
  if (session?.user?.email?.toLowerCase() !== 'syed.haider@insidesuccess.com') return new NextResponse(null, { status: 403 });
  const connection = process.env.DATABASE_URL;
  if (!connection) return NextResponse.json({ configured: false }, { status: 503 });
  const url = new URL(connection);
  const sql = neon(connection);
  const rows = await sql`select current_database() as database`;
  return NextResponse.json({ configured: true, database: rows[0].database, connectionFingerprint: createHash('sha256').update(connection).digest('hex'), hostFingerprint: createHash('sha256').update(url.hostname).digest('hex') }, { headers: { 'Cache-Control': 'no-store' } });
}
