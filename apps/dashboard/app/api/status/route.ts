import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const store = getStore();
  const currentCycle = store.getCurrentCycle();
  return NextResponse.json({
    currentCycle,
    serverTime: Date.now(),
  });
}
