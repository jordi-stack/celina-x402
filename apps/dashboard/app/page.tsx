'use client';

import { useState } from 'react';
import type { ResearchSession } from '@x402/shared';
import { AskBox } from '@/components/AskBox';
import { ReportCard } from '@/components/ReportCard';
import { SessionHistory } from '@/components/SessionHistory';
import { BalanceCard } from '@/components/BalanceCard';
import { LiveStats } from '@/components/LiveStats';
import { EventStream } from '@/components/EventStream';

export default function HomePage() {
  const [activeSession, setActiveSession] = useState<ResearchSession | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const handleSessionStart = () => {
    setRefreshToken((n) => n + 1);
  };

  // Called by AskBox on every poll tick during a live session. Keeps the
  // ReportCard rendering the latest partial state (growing call list, plan
  // reasons streaming in) instead of staying blank until completion.
  const handleSessionUpdate = (session: ResearchSession) => {
    setActiveSession(session);
  };

  const handleSessionComplete = (session: ResearchSession) => {
    setActiveSession(session);
    setRefreshToken((n) => n + 1);
  };

  return (
    <div className="space-y-6">
      <LiveStats />
      <BalanceCard />
      <AskBox
        onSessionStart={handleSessionStart}
        onSessionUpdate={handleSessionUpdate}
        onSessionComplete={handleSessionComplete}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {activeSession ? (
            <ReportCard session={activeSession} />
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-800/20 p-10 text-center text-sm text-neutral-400">
              Ask a question above to run a research session. Celina will plan
              steps, pay each service via x402, synthesize a verdict, and
              anchor it on-chain — all visible live in this panel.
            </div>
          )}
          <SessionHistory
            selectedId={activeSession?.id ?? null}
            onSelect={setActiveSession}
            refreshToken={refreshToken}
          />
        </div>
        <div className="space-y-6">
          <EventStream />
        </div>
      </div>
    </div>
  );
}
