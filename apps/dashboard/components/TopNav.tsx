'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface AgentStatus {
  agentStatus: 'working' | 'idle';
  busyNow: number;
  sessions: number;
}

const NAV_ITEMS = [
  { href: '/', label: 'Home' },
  { href: '/tx', label: 'Transactions' },
  { href: '/mcp', label: 'MCP Activity' },
  { href: '/learning', label: 'Learning' },
  { href: '/compare', label: 'vs Manual' },
  { href: '/memory', label: 'Memory' },
];

export function TopNav() {
  const pathname = usePathname();
  const [status, setStatus] = useState<AgentStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/stats', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as AgentStatus;
        if (!cancelled) setStatus(json);
      } catch {
        // Non-fatal: nav status indicator falls back to neutral.
      }
    };
    void load();
    const interval = setInterval(load, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const working = status?.agentStatus === 'working';

  return (
    <header className="mb-8">
      <div className="flex items-baseline gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Celina</h1>
        <div className="flex items-baseline gap-2">
          {working ? (
            <span className="relative flex h-2 w-2 self-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
            </span>
          ) : (
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 self-center" />
          )}
          <span
            className={`text-[10px] uppercase tracking-wide font-semibold ${
              working ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {working ? 'working' : 'idle'}
          </span>
        </div>
        <span className="text-sm text-neutral-400 italic">
          I ask the blockchain. It pays itself to answer.
        </span>
      </div>

      <nav className="mt-4 flex flex-wrap gap-1 border-b border-neutral-700">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
              className={`relative px-3 py-2 text-xs uppercase tracking-wide transition ${
                active
                  ? 'text-neutral-100'
                  : 'text-neutral-400 hover:text-neutral-300'
              }`}
            >
              {item.label}
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-neutral-100" />
              )}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
