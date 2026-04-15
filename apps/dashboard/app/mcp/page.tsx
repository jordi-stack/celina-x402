'use client';

import { useEffect, useState } from 'react';

interface McpCall {
  id: number;
  timestamp: number;
  tool: string;
  durationMs: number;
  success: boolean;
}

interface McpCallsResponse {
  calls: McpCall[];
  stats: {
    total: number;
    successCount: number;
    successRate: number;
    avgDurationMs: number;
  };
  byTool: Array<{ tool: string; count: number }>;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

export default function McpActivityPage() {
  const [data, setData] = useState<McpCallsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCalls = async () => {
      try {
        const res = await fetch('/api/mcp-calls?limit=200', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as McpCallsResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    };

    fetchCalls();
    const interval = setInterval(fetchCalls, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">MCP Activity</h2>
        <span className="text-xs text-neutral-400">auto-refresh every 3s</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total MCP calls" value={data?.stats.total ?? 0} />
        <StatCard
          label="Success rate"
          value={
            data
              ? `${(data.stats.successRate * 100).toFixed(1)}%`
              : '-'
          }
        />
        <StatCard
          label="Avg duration"
          value={
            data ? `${Math.round(data.stats.avgDurationMs)}ms` : '-'
          }
        />
      </div>

      {data && data.byTool.length > 0 && (
        <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4">
          <div className="text-xs uppercase text-neutral-400 mb-3">Calls by tool</div>
          <div className="flex flex-wrap gap-2">
            {data.byTool.map((t) => (
              <span
                key={t.tool}
                className="rounded bg-neutral-800 px-3 py-1 text-xs font-mono"
              >
                {t.tool}
                <span className="ml-2 text-neutral-400">{t.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 overflow-hidden">
        <div className="flex items-baseline justify-between px-4 py-2 border-b border-neutral-700 bg-neutral-800/60">
          <span className="text-[10px] uppercase tracking-wide text-neutral-400">
            recent calls
          </span>
          {data && (
            <span className="text-[10px] uppercase tracking-wide text-neutral-400">
              showing {data.calls.length}
            </span>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-800 text-neutral-400 text-xs uppercase sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Tool</th>
                <th className="px-4 py-3 text-left">Duration</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-rose-400">
                    Error: {error}
                  </td>
                </tr>
              )}
              {!error && !data && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                    Loading...
                  </td>
                </tr>
              )}
              {data && data.calls.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                    No MCP calls recorded yet. Start the Producer + Consumer and wait for the first cycle.
                  </td>
                </tr>
              )}
              {data?.calls.map((c) => (
                <tr key={c.id} className="border-t border-neutral-700 hover:bg-neutral-800/40">
                  <td className="px-4 py-3 font-mono text-xs text-neutral-400">
                    {formatTime(c.timestamp)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{c.tool}</td>
                  <td className="px-4 py-3 font-mono text-xs">{c.durationMs}ms</td>
                  <td className="px-4 py-3">
                    <StatusBadge success={c.success} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4">
      <div className="text-xs uppercase text-neutral-400">{label}</div>
      <div className="mt-2 text-2xl font-bold font-mono">{value}</div>
    </div>
  );
}

function StatusBadge({ success }: { success: boolean }) {
  return (
    <span
      className={`rounded px-2 py-1 text-xs font-medium ${
        success ? 'bg-emerald-900 text-emerald-300' : 'bg-rose-900 text-rose-300'
      }`}
    >
      {success ? 'ok' : 'fail'}
    </span>
  );
}
