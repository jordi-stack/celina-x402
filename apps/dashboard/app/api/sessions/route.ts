import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
  const store = getStore();
  const sessions = store.listRecentQuerySessions(limit);
  return NextResponse.json({ sessions });
}
