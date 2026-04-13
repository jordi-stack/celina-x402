'use client';

import type { SseEvent } from '@/lib/useSseEvents';

interface Props {
  events: SseEvent[];
}

export function BalanceDisplay({ events }: Props) {
  const totalEarned = events
    .filter((e) => e.kind === 'SETTLEMENT_COMPLETED')
    .reduce((sum, e) => sum + Number(e.payload.amount ?? 0), 0);
  const totalSpent = events
    .filter((e) => e.kind === 'SERVICE_CONSUMED')
    .reduce((sum, e) => sum + Number(e.payload.amount ?? 0), 0);

  const net = totalEarned - totalSpent;
  const earnedUsdg = (totalEarned / 1_000_000).toFixed(4);
  const spentUsdg = (totalSpent / 1_000_000).toFixed(4);
  const netUsdg = (net / 1_000_000).toFixed(4);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
      <div className="text-sm uppercase tracking-wide text-neutral-400 mb-2">
        Aria Economy
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-neutral-500">Earned</div>
          <div className="text-2xl font-bold text-emerald-400">+{earnedUsdg}</div>
          <div className="text-xs text-neutral-600">USDG</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">Spent</div>
          <div className="text-2xl font-bold text-rose-400">-{spentUsdg}</div>
          <div className="text-xs text-neutral-600">USDG</div>
        </div>
        <div>
          <div className="text-xs text-neutral-500">Net</div>
          <div
            className={`text-2xl font-bold ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {net >= 0 ? '+' : ''}
            {netUsdg}
          </div>
          <div className="text-xs text-neutral-600">USDG</div>
        </div>
      </div>
    </div>
  );
}
