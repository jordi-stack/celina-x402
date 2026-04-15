import Fastify, { type FastifyInstance } from 'fastify';
import type { Store, EventBus } from '@x402/orchestrator';
import type { WalletClient, X402PaymentClient, AttestationClient } from '@x402/onchain-clients';
import { getAttestationFromChain } from '@x402/onchain-clients';
import type { ReasonerClient } from '../reasoner/client';
import { runSession, type SessionRunnerConfig } from '../agent/session-runner';
import {
  RESEARCH_SERVICE_CATALOG,
  X_LAYER_CAIP2,
  USDG_CONTRACT,
  CONSUMER_API_PORT,
} from '@x402/shared';

export interface AskServerOptions {
  store: Store;
  eventBus: EventBus;
  reasoner: ReasonerClient;
  walletClient: WalletClient;
  paymentClient: X402PaymentClient;
  attestationClient: AttestationClient;
  runnerConfig: SessionRunnerConfig;
}

export async function buildAskServer(opts: AskServerOptions): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: { level: 'info' } });

  fastify.get('/health', async () => ({ status: 'ok', time: Date.now() }));

  // Machine-readable agent capability manifest. Other agents or tools can
  // GET /capabilities to discover which paid services Celina exposes, their
  // prices, input schemas, and the x402 payment details required to call them.
  fastify.get('/capabilities', async () => {
    const services = Object.entries(RESEARCH_SERVICE_CATALOG).map(([name, meta]) => ({
      name,
      path: meta.path,
      priceUsdg: meta.priceUsdg,
      priceMinimal: meta.priceMinimal,
      summary: meta.summary,
      argsHint: meta.argsHint,
      provider: meta.provider,
    }));
    return {
      agent: 'celina',
      version: '0.1.0',
      description:
        'x402 Onchain Intelligence Agent. POST /ask with a natural-language question about a token or wallet on X Layer. Celina plans a series of paid research calls, settles each on chain 196 via OKX Facilitator, and returns a structured verdict with a confidence score and on-chain attestation.',
      endpoint: `http://localhost:${CONSUMER_API_PORT}`,
      x402: {
        network: X_LAYER_CAIP2,
        paymentToken: USDG_CONTRACT,
        paymentTokenSymbol: 'USDG',
        paymentTokenDecimals: 6,
        facilitator: 'https://web3.okx.com/api/v6/pay/x402',
      },
      services,
      endpoints: [
        { method: 'POST', path: '/ask', description: 'Start a research session. Returns 202 + {id} immediately; poll GET /sessions/:id for status.' },
        { method: 'GET', path: '/sessions/:id', description: 'Poll a session by id. Returns ResearchSession with status, calls, synthesis, and attestation.' },
        { method: 'GET', path: '/sessions', description: 'List recent sessions (default 20, max 50).' },
        { method: 'GET', path: '/verify/:sessionHash', description: 'Verify an attested verdict on-chain via CelinaAttestation.sol.' },
        { method: 'GET', path: '/capabilities', description: 'This document.' },
        { method: 'GET', path: '/health', description: 'Health probe.' },
      ],
      attestation: {
        contract: opts.runnerConfig.celinaAttestationAddress,
        network: X_LAYER_CAIP2,
        description: 'Each completed session is hashed and anchored to CelinaAttestation.sol on X Layer. GET /verify/:sessionHash to confirm any verdict without trusting Celina.',
      },
    };
  });

  fastify.post('/ask', async (request, reply) => {
    const body = request.body as { question?: unknown; wait?: boolean };
    if (typeof body?.question !== 'string' || body.question.trim().length === 0) {
      reply.code(400);
      return { error: 'question (string) required in body' };
    }
    const question = body.question.trim().slice(0, 2000);
    const wait = body.wait === true;

    // Async mode (default): insert session, fire runner in background, return
    // the session id immediately so the caller can poll GET /sessions/:id for
    // live status updates while the research runs.  wait=true preserves the
    // old synchronous behaviour for scripts that expect the full session back.
    if (wait) {
      const session = await runSession(
        {
          store: opts.store,
          eventBus: opts.eventBus,
          reasoner: opts.reasoner,
          walletClient: opts.walletClient,
          paymentClient: opts.paymentClient,
          attestationClient: opts.attestationClient,
          config: opts.runnerConfig,
        },
        { question }
      );
      return session;
    }

    const { randomUUID } = await import('node:crypto');
    const preId = `q_${randomUUID()}`;
    void runSession(
      {
        store: opts.store,
        eventBus: opts.eventBus,
        reasoner: opts.reasoner,
        walletClient: opts.walletClient,
        paymentClient: opts.paymentClient,
        attestationClient: opts.attestationClient,
        config: opts.runnerConfig,
      },
      { question, preId }
    ).catch((err: unknown) => {
      fastify.log.error({ err }, 'runSession background error');
    });
    reply.code(202);
    return { id: preId, status: 'planning' };
  });

  // Read-only on-chain verification. Returns the raw contract row so any
  // caller can independently confirm the verdict hash without trusting
  // Celina's own database. 404 when nothing is attested for that hash yet.
  fastify.get('/verify/:sessionHash', async (request, reply) => {
    const params = request.params as { sessionHash: string };
    const hash = params.sessionHash as `0x${string}`;
    try {
      const row = await getAttestationFromChain({
        rpcUrl: opts.runnerConfig.xlayerRpcUrl,
        contractAddress: opts.runnerConfig.celinaAttestationAddress as `0x${string}`,
        sessionHash: hash,
      });
      if (!row) {
        reply.code(404);
        return { error: 'not attested' };
      }
      return { ok: true, attestation: row };
    } catch (err) {
      reply.code(502);
      return { error: `chain read failed: ${(err as Error).message}` };
    }
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
