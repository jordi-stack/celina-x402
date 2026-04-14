import Fastify, { type FastifyInstance } from 'fastify';
import type { Store, EventBus } from '@x402/orchestrator';
import type { WalletClient, X402PaymentClient } from '@x402/onchain-clients';
import type { ReasonerClient } from '../reasoner/client';
import { runSession, type SessionRunnerConfig } from '../agent/session-runner';

export interface AskServerOptions {
  store: Store;
  eventBus: EventBus;
  reasoner: ReasonerClient;
  walletClient: WalletClient;
  paymentClient: X402PaymentClient;
  runnerConfig: SessionRunnerConfig;
}

export async function buildAskServer(opts: AskServerOptions): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: { level: 'info' } });

  fastify.get('/health', async () => ({ status: 'ok', time: Date.now() }));

  fastify.post('/ask', async (request, reply) => {
    const body = request.body as { question?: unknown };
    if (typeof body?.question !== 'string' || body.question.trim().length === 0) {
      reply.code(400);
      return { error: 'question (string) required in body' };
    }
    const question = body.question.trim().slice(0, 2000);

    const session = await runSession(
      {
        store: opts.store,
        eventBus: opts.eventBus,
        reasoner: opts.reasoner,
        walletClient: opts.walletClient,
        paymentClient: opts.paymentClient,
        config: opts.runnerConfig,
      },
      { question }
    );
    return session;
  });

  fastify.get('/sessions/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const session = opts.store.getQuerySession(params.id);
    if (!session) {
      reply.code(404);
      return { error: 'session not found' };
    }
    return session;
  });

  fastify.get('/sessions', async (request) => {
    const query = request.query as { limit?: string };
    const limit = Math.min(50, Math.max(1, Number(query.limit ?? '20')));
    return { sessions: opts.store.listRecentQuerySessions(limit) };
  });

  return fastify;
}
