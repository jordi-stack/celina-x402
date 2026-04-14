import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: { params: { id: string } }) {
  const store = getStore();
  const session = store.getQuerySession(context.params.id);
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }
  return NextResponse.json(session);
}
