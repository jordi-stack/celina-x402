import { NextRequest, NextResponse } from 'next/server';
import { CONSUMER_API_PORT } from '@x402/shared';

export const dynamic = 'force-dynamic';

const CONSUMER_URL = process.env.CONSUMER_URL ?? `http://localhost:${CONSUMER_API_PORT}`;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const res = await fetch(`${CONSUMER_URL}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
