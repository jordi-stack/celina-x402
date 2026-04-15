'use client';

import { useEffect, useState } from 'react';
import type { ResearchSession } from '@x402/shared';

interface Props {
  selectedId: string | null;
  onSelect: (session: ResearchSession) => void;
  refreshToken: number;
}

function usdgFromMinimal(minimal: string): string {
  const n = Number(minimal);
  if (!Number.isFinite(n)) return minimal;
  return (n / 1_000_000).toFixed(4);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

export function SessionHistory({ selectedId, onSelect, refreshToken }: Props) {
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/sessions?limit=50', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { sessions: ResearchSession[] };
        if (!cancelled) {
          setSessions(json.sessions);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    };
    void load();
    const interval = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshToken]);

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-6">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-sm uppercase tracking-wide text-neutral-400">
          Recent Sessions
        </div>
        {sessions.length > 0 && (
          <span className="text-[10px] uppercase tracking-wide text-neutral-400">
            {sessions.length} · scroll for more
          </span>
        )}
      </div>
      {error && sessions.length === 0 && (
        <div className="text-xs text-rose-400">Error: {error}</div>
      )}
      {!error && sessions.length === 0 && (
        <div className="text-xs text-neutral-500">No sessions yet. Ask something above.</div>
      )}
      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 -mr-1">
        {sessions.map((s) => {
          const selected = s.id === selectedId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              className={`w-full text-left rounded border px-3 py-2 text-xs transition ${
                selected
                  ? 'border-neutral-500 bg-neutral-800/60'
                  : 'border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-neutral-400 font-mono">{formatTime(s.createdAt)}</span>
                <span className="text-neutral-500">{usdgFromMinimal(s.totalSpent)} USDG</span>
              </div>
              <div className="mt-1 text-neutral-200 truncate">{s.question}</div>
              {s.synthesis && (
                <div className="mt-1 text-neutral-400 truncate italic">
                  {s.synthesis.verdict}
                </div>
              )}
              {!s.synthesis && s.status !== 'done' && (
                <div className="mt-1 text-xs text-amber-400">{s.status}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
