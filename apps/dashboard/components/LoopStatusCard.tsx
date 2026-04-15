'use client';

import type { SseEvent } from '@/lib/useSseEvents';

interface Props {
  events: SseEvent[];
}

export function LoopStatusCard({ events }: Props) {
  const latestCycleEvent = [...events].reverse().find((e) => e.cycleNumber !== null);
  const currentCycle = latestCycleEvent?.cycleNumber ?? 0;

  const completedCycles = events.filter((e) => e.kind === 'LOOP_CYCLE_COMPLETED').length;

  const last60sEvents = events.filter(
    (e) => e.kind === 'LOOP_CYCLE_COMPLETED' && Date.now() - e.timestamp < 60_000
  );
  const velocityPerMin = last60sEvents.length;

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-6">
      <div className="text-sm uppercase tracking-wide text-neutral-400 mb-2">
        Loop Status
      </div>
      <div className="flex items-baseline gap-6">
        <div>
          <div className="text-xs text-neutral-400">Current Cycle</div>
          <div className="text-3xl font-bold">#{currentCycle}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-400">Completed</div>
          <div className="text-3xl font-bold">{completedCycles}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-400">Velocity</div>
          <div className="text-3xl font-bold">
            {velocityPerMin}
            <span className="text-sm text-neutral-400 ml-1">/min</span>
          </div>
        </div>
      </div>
    </div>
  );
}
