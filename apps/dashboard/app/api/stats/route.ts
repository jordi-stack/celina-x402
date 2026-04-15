import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Lifetime stats for the dashboard hero strip. Reads the last 500 query
 * sessions (more than enough for the demo window) and aggregates totals
 * client-side: sessions count, total paid calls, USDG spent, attested
 * verdicts, and whether the agent is currently busy.
 */
export async function GET() {
  const store = getStore();
  const sessions = store.listRecentQuerySessions(500);

  let totalCalls = 0;
  let totalSpentMinimal = 0n;
  let attestedCount = 0;
  let doneCount = 0;
  let busyNow = 0;
  let failedCount = 0;

  const ACTIVE_STATUSES = new Set(['planning', 'calling', 'synthesizing']);

  for (const s of sessions) {
    totalCalls += s.calls.length;
    try {
      totalSpentMinimal += BigInt(s.totalSpent || '0');
    } catch {
      // ignore malformed totalSpent strings
    }
    if (s.attestation?.txHash) attestedCount += 1;
    if (s.status === 'done') doneCount += 1;
    if (s.status === 'failed' || s.status === 'aborted') failedCount += 1;
    if (ACTIVE_STATUSES.has(s.status)) busyNow += 1;
  }

  const totalSpentUsdg = Number(totalSpentMinimal) / 1_000_000;

  return NextResponse.json({
    sessions: sessions.length,
    doneSessions: doneCount,
    failedSessions: failedCount,
    totalCalls,
    totalSpentUsdg: totalSpentUsdg.toFixed(4),
    totalSpentMinimal: totalSpentMinimal.toString(),
    attestedOnChain: attestedCount,
    busyNow,
    agentStatus: busyNow > 0 ? 'working' : 'idle',
    fetchedAt: Date.now(),
  });
}
