import { NextRequest } from 'next/server';
import { getEventBus } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const bus = getEventBus();
  const url = new URL(request.url);
  const sinceId = Number(url.searchParams.get('sinceId') ?? '0');

  const stream = new ReadableStream({
    start(controller) {
      let lastId = sinceId;
      const encoder = new TextEncoder();

      const poll = () => {
        try {
          const events = bus.replay({ sinceId: lastId, limit: 100 });
          for (const event of events) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
            lastId = event.id;
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
