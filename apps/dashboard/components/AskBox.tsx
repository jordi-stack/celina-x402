'use client';

import { useState } from 'react';
import type { ResearchSession } from '@x402/shared';

interface Props {
  onSessionStart: (sessionId: string) => void;
  onSessionUpdate: (session: ResearchSession) => void;
  onSessionComplete: (session: ResearchSession) => void;
}

const SUGGESTIONS = [
  'Is 0x4ae46a509f6b1d9056937ba4500cb143933d2dc8 a safe token to buy?',
  'Deep-dive 0x779ded0c9e1022225f8e0630b35a9b54be713736 (deep-dive triggers the sub-agent x402 chain)',
  'Who is trading 0x4ae46a509f6b1d9056937ba4500cb143933d2dc8 right now?',
  'Is 0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25 a risky wallet?',
];

const TERMINAL_STATUSES = new Set(['done', 'failed', 'aborted']);

function statusLabel(status: string, callCount: number): string {
  switch (status) {
    case 'planning':
      return callCount === 0
        ? 'Planning the first call...'
        : `Planning step ${callCount + 1}...`;
    case 'calling':
      return `Calling paid service (#${callCount})...`;
    case 'synthesizing':
      return 'Synthesizing verdict + grading each call...';
    case 'done':
      return 'Done';
    case 'failed':
      return 'Failed';
    case 'aborted':
      return 'Aborted';
    default:
      return 'Working...';
  }
}

export function AskBox({ onSessionStart, onSessionUpdate, onSessionComplete }: Props) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollSession = async (sessionId: string) => {
    const MAX_POLLS = 180; // 3 minutes at 1s intervals
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await fetch(`/api/sessions/${sessionId}`, { cache: 'no-store' });
        if (!res.ok) continue;
        const session = (await res.json()) as ResearchSession;
        setLiveStatus(statusLabel(session.status, session.calls.length));
        // Push every poll tick upstream so HomePage can render the session
        // as it unfolds (growing call list, live status, etc.) instead of
        // only flipping from placeholder to final report.
        onSessionUpdate(session);
        if (TERMINAL_STATUSES.has(session.status)) {
          return session;
        }
      } catch {
        // transient fetch errors during polling are non-fatal
      }
    }
    throw new Error('Session timed out after 3 minutes');
  };

  const submit = async (q: string) => {
    if (!q.trim() || busy) return;
    setBusy(true);
    setError(null);
    setLiveStatus('Submitting...');
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q.trim() }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text.slice(0, 200)}`);
      }
      const body = (await res.json()) as { id: string; status: string } | ResearchSession;
      const sessionId = body.id;
      if (!sessionId) throw new Error('No session id in response');

      onSessionStart(sessionId);
      setLiveStatus('Planning the first call...');

      // If the server already returned a terminal session (wait=true legacy),
      // use it directly. Otherwise poll until the background run finishes.
      if (TERMINAL_STATUSES.has((body as ResearchSession).status ?? '')) {
        onSessionComplete(body as ResearchSession);
      } else {
        const completed = await pollSession(sessionId);
        onSessionComplete(completed);
      }
      setQuestion('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      setLiveStatus(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd+Enter (mac) or Ctrl+Enter (win/linux) submits the form without
    // the user having to move their hands to the mouse.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void submit(question);
    }
  };

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-6">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-sm uppercase tracking-wide text-neutral-400">Ask Celina</div>
        <div className="text-[10px] uppercase tracking-wide text-neutral-500">
          ⌘/Ctrl + Enter to submit
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(question);
        }}
        className="space-y-3"
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
          rows={2}
          placeholder="Paste a token or wallet address, ask a question. e.g. is 0x4ae4...d2dc8 a scam?"
          className="w-full rounded border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm font-mono text-neutral-100 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
        />
        <div className="flex items-center justify-between">
          <div className="text-xs text-neutral-400">
            {liveStatus ? (
              <span className="text-blue-400 font-mono inline-flex items-baseline gap-2">
                <span className="relative inline-flex h-2 w-2 self-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
                </span>
                {liveStatus}
              </span>
            ) : (
              'Each call is paid via x402 from the Consumer wallet.'
            )}
          </div>
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="rounded bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Researching...' : 'Ask'}
          </button>
        </div>
      </form>
      {error && (
        <div className="mt-3 text-xs text-rose-400 font-mono break-all">{error}</div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            type="button"
            disabled={busy}
            onClick={() => void submit(s)}
            className="text-xs rounded-full border border-neutral-600 px-3 py-1 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 disabled:opacity-40"
          >
            {s.length > 70 ? s.slice(0, 67) + '...' : s}
          </button>
        ))}
      </div>
    </div>
  );
}
