'use client';

import type { SseEvent } from '@/lib/useSseEvents';

interface Props {
  events: SseEvent[];
}

const KIND_COLOR: Record<string, string> = {
  LOOP_CYCLE_STARTED: 'text-blue-400',
  DECISION_MADE: 'text-purple-400',
  PAYMENT_VERIFIED: 'text-cyan-400',
  SETTLEMENT_COMPLETED: 'text-emerald-400',
  SERVICE_CONSUMED: 'text-amber-400',
  LOOP_CYCLE_COMPLETED: 'text-green-400',
  SETTLEMENT_FAILED: 'text-rose-400',
};

export function EventFeed({ events }: Props) {
  const recent = [...events].reverse().slice(0, 30);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
      <div className="text-sm uppercase tracking-wide text-neutral-400 mb-4">
        Live Event Feed
      </div>
      <div className="space-y-1 font-mono text-xs">
        {recent.length === 0 && (
          <div className="text-neutral-600">No events yet. Start the loop.</div>
        )}
        {recent.map((event) => (
          <div key={event.id} className="flex gap-3">
            <span className="text-neutral-600">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
            <span className={KIND_COLOR[event.kind] ?? 'text-neutral-300'}>
              {event.kind}
            </span>
            <span className="text-neutral-500">
              #{event.cycleNumber ?? '-'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
