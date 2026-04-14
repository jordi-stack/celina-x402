'use client';

import { useEffect, useState } from 'react';

interface WalletBalance {
  label: string;
  address: string;
  usdg: string | null;
  rawUsdg: string | null;
  error: string | null;
  fetchedAt: number;
}

interface LiveBalanceResponse {
  consumer: WalletBalance;
  producer: WalletBalance;
  source: string;
  chain: string;
  token: string;
  error?: string;
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUsdg(raw: string | null): string {
  if (raw === null) return '--';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toFixed(6);
}

export function BalanceCard() {
  const [data, setData] = useState<LiveBalanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchBalances = async () => {
      try {
        const res = await fetch('/api/live-balance', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as LiveBalanceResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    };

    fetchBalances();
    const interval = setInterval(fetchBalances, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm uppercase tracking-wide text-neutral-400">
          Live wallet balance
        </h3>
        <span className="text-xs text-neutral-500">
          via OKX MCP &middot; refresh 5s
        </span>
      </div>

      {error && !data && (
        <div className="text-rose-400 text-sm">Error: {error}</div>
      )}
      {!error && !data && (
        <div className="text-neutral-500 text-sm">Loading...</div>
      )}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <WalletColumn wallet={data.consumer} tint="rose" />
          <WalletColumn wallet={data.producer} tint="emerald" />
        </div>
      )}
    </div>
  );
}

function WalletColumn({
  wallet,
  tint,
}: {
  wallet: WalletBalance;
  tint: 'rose' | 'emerald';
}) {
  const tintClass = tint === 'rose' ? 'text-rose-300' : 'text-emerald-300';
  const arrow = tint === 'rose' ? '-' : '+';
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs uppercase text-neutral-500">{wallet.label}</span>
        <span className="font-mono text-xs text-neutral-600">
          {shortAddress(wallet.address)}
        </span>
      </div>
      <div className={`mt-2 text-3xl font-bold font-mono ${tintClass}`}>
        {wallet.error ? (
          <span className="text-neutral-600">N/A</span>
        ) : (
          <>
            <span className="text-neutral-600 text-lg mr-1">{arrow}</span>
            {formatUsdg(wallet.usdg)}
            <span className="text-neutral-500 text-sm ml-2">USDG</span>
          </>
        )}
      </div>
      {wallet.error && (
        <div className="text-xs text-rose-500 mt-1 truncate">{wallet.error}</div>
      )}
    </div>
  );
}
