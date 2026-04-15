'use client';

import { useEffect, useState } from 'react';

interface StatsResponse {
  sessions: number;
  doneSessions: number;
  failedSessions: number;
  totalCalls: number;
  totalSpentUsdg: string;
  totalSpentMinimal: string;
  attestedOnChain: number;
  busyNow: number;
  agentStatus: 'working' | 'idle';
  fetchedAt: number;
}

export function LiveStats() {
  const [stats, setStats] = useState<StatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/stats', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as StatsResponse;
        if (!cancelled) setStats(json);
      } catch {
        // Non-fatal: stats panel falls back to dashes if the call errors.
      }
    };
    void load();
    const interval = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="rounded-lg border border-neutral-700 bg-gradient-to-r from-neutral-800 via-neutral-800/60 to-neutral-800 p-5">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
        <StatItem label="Sessions" value={stats?.sessions ?? '—'} accent="text-neutral-100" />
        <Divider />
        <StatItem
          label="Paid calls"
          value={stats?.totalCalls ?? '—'}
          accent="text-sky-300"
        />
        <Divider />
        <StatItem
          label="USDG spent"
          value={stats ? `$${stats.totalSpentUsdg}` : '—'}
          accent="text-amber-300"
        />
        <Divider />
        <StatItem
          label="Attested on-chain"
          value={stats?.attestedOnChain ?? '—'}
          accent="text-violet-300"
        />
        <div className="ml-auto flex items-baseline gap-2 text-[11px] uppercase tracking-wide">
          {stats?.agentStatus === 'working' ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
              <span className="text-amber-300 font-semibold">agent working</span>
            </>
          ) : (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-emerald-400 font-semibold">agent idle</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</span>
      <span className={`text-2xl font-bold font-mono tabular-nums ${accent}`}>{value}</span>
    </div>
  );
}

function Divider() {
  return <span className="hidden sm:inline h-10 w-px bg-neutral-800" />;
}
