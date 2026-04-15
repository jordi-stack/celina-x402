import { NextRequest } from 'next/server';
import { getDb, getEventBus } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Event kinds emitted by the current (post-pivot) architecture. Anything
// else in audit_events is legacy noise from the old earn-pay-earn loop and
// should be filtered out before hitting the SSE stream.
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

// How many recent active events to send as tail history when a new client
// connects without specifying sinceId. Keeps the dashboard from flooding on
// first load with thousands of legacy rows.
const DEFAULT_TAIL = 20;

export async function GET(request: NextRequest) {
  const bus = getEventBus();
  const db = getDb();
  const url = new URL(request.url);
  const sinceIdParam = url.searchParams.get('sinceId');

  // Default sinceId: start from (maxId - DEFAULT_TAIL) so the client sees a
  // small history window plus all subsequent live events, instead of the
  // full pre-pivot event log. Clients can override with ?sinceId=N for a
  // complete replay.
  let initialSinceId: number;
  if (sinceIdParam !== null) {
    initialSinceId = Number(sinceIdParam);
  } else {
    const maxRow = db
      .prepare('SELECT MAX(id) as maxId FROM audit_events')
      .get() as { maxId: number | null };
    const maxId = maxRow?.maxId ?? 0;
    initialSinceId = Math.max(0, maxId - DEFAULT_TAIL);
  }

  const stream = new ReadableStream({
    start(controller) {
      let lastId = initialSinceId;
      const encoder = new TextEncoder();

      const poll = () => {
        try {
          const events = bus.replay({ sinceId: lastId, limit: 100 });
          for (const event of events) {
            // Always advance lastId so legacy rows don't re-stream on the
            // next tick, but only forward active kinds to the client.
            lastId = event.id;
            if (!ACTIVE_KINDS.has(event.kind)) continue;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
          }
        } catch (err) {
          try {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`
              )
            );
          } catch {
            // Controller may already be closed; swallow to avoid throwing in interval.
          }
        }
      };

      const interval = setInterval(poll, 500);
      poll();

      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
