'use client';

import { useSseEvents } from '@/lib/useSseEvents';
import { LoopStatusCard } from '@/components/LoopStatusCard';
import { BalanceDisplay } from '@/components/BalanceDisplay';
import { EventFeed } from '@/components/EventFeed';

export default function HomePage() {
  const events = useSseEvents('/api/events');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <LoopStatusCard events={events} />
        <BalanceDisplay events={events} />
      </div>
      <EventFeed events={events} />
      <div className="flex gap-4 text-sm">
        <a
          href="/tx"
          className="rounded border border-neutral-700 px-4 py-2 hover:bg-neutral-800"
        >
          Transactions -&gt;
        </a>
      </div>
    </div>
  );
}
