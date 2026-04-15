'use client';

import { useState } from 'react';
import type { ResearchSession } from '@x402/shared';
import { AskBox } from '@/components/AskBox';
import { ReportCard } from '@/components/ReportCard';
import { SessionHistory } from '@/components/SessionHistory';
import { BalanceCard } from '@/components/BalanceCard';

export default function HomePage() {
  const [activeSession, setActiveSession] = useState<ResearchSession | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const handleSessionStart = () => {
    setRefreshToken((n) => n + 1);
  };

  const handleSessionComplete = (session: ResearchSession) => {
    setActiveSession(session);
    setRefreshToken((n) => n + 1);
  };

  return (
    <div className="space-y-6">
      <BalanceCard />
      <AskBox
        onSessionStart={handleSessionStart}
        onSessionComplete={handleSessionComplete}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {activeSession ? (
            <ReportCard session={activeSession} />
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-900/20 p-10 text-center text-sm text-neutral-500">
              Ask a question above to run a research session.
            </div>
          )}
        </div>
        <SessionHistory
          selectedId={activeSession?.id ?? null}
          onSelect={setActiveSession}
          refreshToken={refreshToken}
        />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <a
          href="/tx"
          className="rounded border border-neutral-700 px-4 py-2 hover:bg-neutral-800"
        >
          Transactions -&gt;
        </a>
        <a
          href="/mcp"
          className="rounded border border-neutral-700 px-4 py-2 hover:bg-neutral-800"
        >
          MCP Activity -&gt;
        </a>
        <a
          href="/learning"
          className="rounded border border-neutral-700 px-4 py-2 hover:bg-neutral-800"
        >
          Service Learning -&gt;
        </a>
        <a
          href="/compare"
          className="rounded border border-neutral-700 px-4 py-2 hover:bg-neutral-800"
        >
          vs Manual Research -&gt;
        </a>
        <a
          href="/memory"
          className="rounded border border-neutral-700 px-4 py-2 hover:bg-neutral-800"
        >
          Agent Memory -&gt;
        </a>
      </div>
    </div>
  );
}
