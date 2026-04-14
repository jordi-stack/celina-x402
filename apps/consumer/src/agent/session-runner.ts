import { randomUUID } from 'node:crypto';
import type { Store, EventBus } from '@x402/orchestrator';
import type {
  ResearchCall,
  ResearchServiceName,
  ResearchSession,
  ResearchStep,
  ResearchSynthesis,
} from '@x402/shared';
import { RESEARCH_SERVICE_CATALOG } from '@x402/shared';
import type { WalletClient, X402PaymentClient } from '@x402/onchain-clients';
import type { ReasonerClient } from '../reasoner/client';
import { parseChallenge402, replayWithPayment } from '../http/replay';

export interface SessionRunnerConfig {
  producerUrl: string;
  consumerAccountId: string;
  maxCalls: number;
  budgetUsdg: string;
}

export interface SessionRunnerDeps {
  store: Store;
  eventBus: EventBus;
  reasoner: ReasonerClient;
  walletClient: WalletClient;
  paymentClient: X402PaymentClient;
  config: SessionRunnerConfig;
}

export interface AskInput {
  question: string;
}

/**
 * Drive ONE user question end-to-end: plan -> (call service + pay)* -> synthesize.
 * Writes progress to query_sessions in SQLite after each transition so the
 * dashboard can poll and render mid-flight state.
 */
export async function runSession(
  deps: SessionRunnerDeps,
  input: AskInput
): Promise<ResearchSession> {
  const id = `q_${randomUUID()}`;
  const session: ResearchSession = {
    id,
    question: input.question,
    status: 'planning',
    calls: [],
    totalSpent: '0',
    synthesis: null,
    createdAt: Date.now(),
    completedAt: null,
    error: null,
  };
  deps.store.insertQuerySession(session);
  deps.eventBus.emit('QUERY_SESSION_STARTED', { sessionId: id, question: input.question });

  // Switch to Consumer account once up front. The producer does the MCP calls
  // from its own keys, so Consumer only needs to hold USDG + sign x402 payments.
  try {
    await deps.walletClient.switchAccount(deps.config.consumerAccountId);
  } catch (err) {
    return fail(deps, session, `wallet switchAccount failed: ${(err as Error).message}`);
  }

  let step: ResearchStep;
  for (let i = 0; i < deps.config.maxCalls + 1; i++) {
    try {
      session.status = 'planning';
      persist(deps, session);
      const { step: nextStep } = await deps.reasoner.planStep({
        question: session.question,
        calls: session.calls,
        totalSpent: session.totalSpent,
        maxCalls: deps.config.maxCalls,
        budgetUsdg: deps.config.budgetUsdg,
      });
      step = nextStep;
    } catch (err) {
      const msg = `planStep failed: ${(err as Error).message}`;
      // Don't throw away paid calls. If we already have usable data,
      // break to synthesize with what we have and record the planner error.
      const hasUsableCalls = session.calls.some(
        (c) => c.error === null && c.data !== null
      );
      if (hasUsableCalls) {
        session.error = msg;
        break;
      }
      return fail(deps, session, msg);
    }

    deps.eventBus.emit('QUERY_PLAN_STEP', {
      sessionId: id,
      action: step.action,
      service: step.service ?? null,
      reason: step.reason,
    });

    if (step.action === 'abort') {
      session.status = 'aborted';
      session.error = step.reason;
      session.completedAt = Date.now();
      persist(deps, session);
      deps.eventBus.emit('QUERY_SESSION_ABORTED', { sessionId: id, reason: step.reason });
      return session;
    }

    if (step.action === 'synthesize') {
      break;
    }

    // action === 'call_service'
    if (!step.service) {
      return fail(deps, session, 'planner returned call_service without service');
    }
    const service = step.service;
    const args = step.serviceArgs ?? {};

    if (session.calls.length >= deps.config.maxCalls) {
      session.error = 'max calls reached, forcing synthesis';
      break;
    }

    session.status = 'calling';
    persist(deps, session);

    const call = await callPaidService(deps, service, args);
    session.calls.push(call);
    session.totalSpent = addMinimal(session.totalSpent, call.amountSpent);
    persist(deps, session);
    deps.eventBus.emit('QUERY_CALL_COMPLETED', {
      sessionId: id,
      service,
      ok: call.error === null,
      txHash: call.txHash,
      amount: call.amountSpent,
    });
  }

  // Synthesize
  session.status = 'synthesizing';
  persist(deps, session);
  let synthesis: ResearchSynthesis;
  try {
    const result = await deps.reasoner.synthesize({
      question: session.question,
      calls: session.calls,
      totalSpent: session.totalSpent,
    });
    synthesis = result.synthesis;
  } catch (err) {
    return fail(deps, session, `synthesize failed: ${(err as Error).message}`);
  }

  session.synthesis = synthesis;
  session.status = 'done';
  session.completedAt = Date.now();
  persist(deps, session);
  deps.eventBus.emit('QUERY_SESSION_DONE', {
    sessionId: id,
    verdict: synthesis.verdict,
    confidence: synthesis.confidence,
    totalSpent: session.totalSpent,
  });
  return session;
}

async function callPaidService(
  deps: SessionRunnerDeps,
  service: ResearchServiceName,
  args: Record<string, unknown>
): Promise<ResearchCall> {
  const startedAt = Date.now();
  const meta = RESEARCH_SERVICE_CATALOG[service];
  const url = `${deps.config.producerUrl}${meta.path}`;

  const base: ResearchCall = {
    service,
    args,
    amountSpent: '0',
    txHash: null,
    data: null,
    error: null,
    startedAt,
    durationMs: 0,
  };

  try {
    const challengeRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });

    if (challengeRes.status !== 402) {
      const body = await challengeRes.text();
      return {
        ...base,
        error: `expected 402, got ${challengeRes.status}: ${body.slice(0, 200)}`,
        durationMs: Date.now() - startedAt,
      };
    }

    const header = challengeRes.headers.get('PAYMENT-REQUIRED');
    if (!header) {
      return {
        ...base,
        error: 'missing PAYMENT-REQUIRED header on 402',
        durationMs: Date.now() - startedAt,
      };
    }

    const challenge = parseChallenge402(header);
    const accept = challenge.accepts[0];
    if (!accept) {
      return {
        ...base,
        error: 'empty accepts array in challenge',
        durationMs: Date.now() - startedAt,
      };
    }

    const proof = await deps.paymentClient.signPayment({ accepts: challenge.accepts });
    const replayResult = await replayWithPayment({ url, body: args, accept, proof });

    if (replayResult.status !== 200) {
      return {
        ...base,
        amountSpent: accept.amount,
        error: `replay returned ${replayResult.status}: ${JSON.stringify(replayResult.data).slice(0, 300)}`,
        durationMs: Date.now() - startedAt,
      };
    }

    // Producer side writes the payments row (settlement via onResponse hook),
    // but the tx hash is not visible in the immediate response body. Poll by
    // nonce with a short timeout so the session record carries it forward.
    const nonce = proof.authorization.nonce;
    const settled = await waitForSettlement(deps.store, nonce, 15_000);

    return {
      ...base,
      amountSpent: accept.amount,
      data: replayResult.data,
      txHash: settled?.txHash ?? null,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ...base,
      error: (err as Error).message,
      durationMs: Date.now() - startedAt,
    };
  }
}

async function waitForSettlement(
  store: Store,
  nonce: string,
  timeoutMs: number
): Promise<{ txHash: string } | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const payment = store.findPaymentByNonce(nonce);
    if (payment?.status === 'settled' && payment.tx_hash) {
      return { txHash: payment.tx_hash };
    }
    if (payment?.status === 'settle_failed') return null;
    await sleep(400);
  }
  return null;
}

function persist(deps: SessionRunnerDeps, session: ResearchSession): void {
  deps.store.updateQuerySession(session.id, {
    status: session.status,
    calls: session.calls,
    totalSpent: session.totalSpent,
    synthesis: session.synthesis,
    completedAt: session.completedAt,
    error: session.error,
  });
}

function fail(
  deps: SessionRunnerDeps,
  session: ResearchSession,
  error: string
): ResearchSession {
  session.status = 'failed';
  session.error = error;
  session.completedAt = Date.now();
  persist(deps, session);
  deps.eventBus.emit('QUERY_SESSION_FAILED', { sessionId: session.id, error });
  return session;
}

function addMinimal(a: string, b: string): string {
  return (BigInt(a || '0') + BigInt(b || '0')).toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
