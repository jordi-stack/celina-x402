import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM payments ORDER BY signed_at DESC LIMIT 200`)
    .all();
  return NextResponse.json({ payments: rows });
}
