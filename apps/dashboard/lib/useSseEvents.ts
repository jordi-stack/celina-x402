'use client';

import { useEffect, useState } from 'react';

export interface SseEvent {
  id: number;
  timestamp: number;
  source: string;
  kind: string;
  cycleNumber: number | null;
  payload: Record<string, unknown>;
}

export function useSseEvents(endpoint: string = '/api/events'): SseEvent[] {
  const [events, setEvents] = useState<SseEvent[]>([]);

  useEffect(() => {
    const eventSource = new EventSource(endpoint);
    eventSource.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as SseEvent;
        setEvents((prev) => {
          const next = [...prev, event];
          return next.length > 500 ? next.slice(-500) : next;
        });
      } catch {
        // ignore malformed events
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
    };
    return () => eventSource.close();
  }, [endpoint]);

  return events;
}
