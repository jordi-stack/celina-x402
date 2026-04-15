'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useSseEvents } from '@/lib/useSseEvents';

// Whitelist of event kinds the current architecture actually emits. Any
// other kind in audit_events is legacy noise from the pre-pivot earn-pay-
// earn loop and should be hidden from the stream. Kept in sync with the
// same list in apps/dashboard/app/api/events/route.ts.
const ACTIVE_KINDS = new Set([
  'QUERY_SESSION_STARTED',
  'QUERY_PLAN_STEP',
  'QUERY_CALL_COMPLETED',
  'QUERY_SESSION_DONE',
  'QUERY_SESSION_FAILED',
  'QUERY_SESSION_ABORTED',
  'PAYMENT_VERIFIED',
  'SETTLEMENT_COMPLETED',
  'SETTLEMENT_FAILED',
]);

const KIND_STYLE: Record<string, { color: string; icon: string }> = {
  QUERY_SESSION_STARTED: { color: 'text-sky-400', icon: '▶' },
  QUERY_PLAN_STEP: { color: 'text-neutral-300', icon: '·' },
  QUERY_CALL_COMPLETED: { color: 'text-amber-300', icon: '$' },
  QUERY_SESSION_DONE: { color: 'text-emerald-400', icon: '✓' },
  QUERY_SESSION_FAILED: { color: 'text-rose-400', icon: '✗' },
  QUERY_SESSION_ABORTED: { color: 'text-neutral-400', icon: '×' },
  PAYMENT_VERIFIED: { color: 'text-cyan-400', icon: '✓' },
  SETTLEMENT_COMPLETED: { color: 'text-amber-300', icon: '$' },
  SETTLEMENT_FAILED: { color: 'text-rose-400', icon: '✗' },
};

function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

function summarizePayload(kind: string, payload: Record<string, unknown>): string {
  switch (kind) {
    case 'QUERY_SESSION_STARTED': {
      const q = typeof payload.question === 'string' ? payload.question : '';
      const short = q.length > 36 ? q.slice(0, 33) + '…' : q;
      return `new session · "${short}"`;
    }
    case 'QUERY_PLAN_STEP': {
      const action = typeof payload.action === 'string' ? payload.action : '?';
      const service =
        typeof payload.service === 'string' ? payload.service : null;
      const conf =
        typeof payload.confidence === 'number'
          ? ` (conf ${payload.confidence.toFixed(2)})`
          : '';
      if (action === 'call_service' && service) return `plan → ${service}${conf}`;
      if (action === 'synthesize') return `plan → synthesize${conf}`;
      if (action === 'abort') return `plan → abort${conf}`;
      return `plan → ${action}${conf}`;
    }
    case 'QUERY_CALL_COMPLETED': {
      const service = typeof payload.service === 'string' ? payload.service : '?';
      const amount =
        typeof payload.amount === 'string'
          ? (Number(payload.amount) / 1_000_000).toFixed(3)
          : '?';
      const ok = payload.ok === true;
      return `${ok ? 'paid' : 'failed'} ${service} · ${amount} USDG`;
    }
    case 'QUERY_SESSION_DONE': {
      const conf = typeof payload.confidence === 'string' ? payload.confidence : '';
      const score =
        typeof payload.confidenceScore === 'number'
          ? payload.confidenceScore.toFixed(2)
          : '?';
      return `done · ${conf} ${score}`;
    }
    case 'QUERY_SESSION_FAILED':
      return `failed · ${payload.error ?? 'unknown'}`;
    case 'QUERY_SESSION_ABORTED':
      return `aborted · ${payload.reason ?? ''}`;
    case 'PAYMENT_VERIFIED': {
      const service = typeof payload.service === 'string' ? payload.service : '?';
      return `verified ${service}`;
    }
    case 'SETTLEMENT_COMPLETED': {
      const service = typeof payload.service === 'string' ? payload.service : '?';
      const tx = typeof payload.txHash === 'string' ? payload.txHash.slice(0, 10) + '…' : '';
      return `settled ${service} ${tx}`;
    }
    case 'SETTLEMENT_FAILED':
      return `settle failed`;
    default:
      return '';
  }
}

export function EventStream() {
  const events = useSseEvents('/api/events');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter out legacy event kinds (pre-pivot loop leftovers) as a safety
  // net even though the API route also filters. Cap at 40 rows so the panel
  // stays readable on demo day; show most recent first.
  const recent = useMemo(
    () => events.filter((e) => ACTIVE_KINDS.has(e.kind)).slice().reverse().slice(0, 40),
    [events]
  );

  // Auto-scroll to top when new events arrive so the newest line is always
  // visible without the judge having to scroll.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [events.length]);

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <div className="text-sm uppercase tracking-wide text-neutral-400">
            Live Event Stream
          </div>
          <span className="relative inline-flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-neutral-400">
          SSE · {recent.length} shown
        </span>
      </div>

      <div
        ref={scrollRef}
        className="max-h-[420px] overflow-y-auto space-y-1 font-mono text-[11px] pr-1"
      >
        {recent.length === 0 && (
          <div className="text-neutral-500 italic">
            No events yet. Ask a question to see the agent think in real time.
          </div>
        )}
        {recent.map((ev) => {
          const style = KIND_STYLE[ev.kind] ?? { color: 'text-neutral-400', icon: '·' };
          const summary = summarizePayload(ev.kind, ev.payload);
          return (
            <div key={ev.id} className="flex gap-2 leading-snug">
              <span className="text-neutral-500 shrink-0">{formatClock(ev.timestamp)}</span>
              <span className={`${style.color} shrink-0 w-4 text-center`}>{style.icon}</span>
              <div className="min-w-0 flex-1">
                <span className="text-neutral-400 text-[10px] uppercase mr-1.5">
                  {ev.source}
                </span>
                <span className={style.color}>{ev.kind.toLowerCase().replace(/_/g, ' ')}</span>
                {summary && (
                  <span className="text-neutral-400 ml-1.5 break-words">{summary}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
