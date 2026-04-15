import { randomUUID } from 'node:crypto';
import type { Store, EventBus } from '@x402/orchestrator';
import type {
  ResearchCall,
  ResearchServiceName,
  ResearchSession,
  ResearchStep,
  ResearchSynthesis,
} from '@x402/shared';
import { RESEARCH_SERVICE_CATALOG, buildCanonicalVerdict, canonicalStringify } from '@x402/shared';
import type { WalletClient, X402PaymentClient, AttestationClient } from '@x402/onchain-clients';
import type { ReasonerClient } from '../reasoner/client';
import { parseChallenge402, replayWithPayment } from '../http/replay';
import { checkDedup, persistToMemory } from '../memory/dedup';

export interface SessionRunnerConfig {
  producerUrl: string;
  subagentUrl: string;
  consumerAccountId: string;
  consumerAccountAddress: string;
  celinaAttestationAddress: string;
  xlayerRpcUrl: string;
  maxCalls: number;
  budgetUsdg: string;
}

export interface SessionRunnerDeps {
  store: Store;
  eventBus: EventBus;
  reasoner: ReasonerClient;
  walletClient: WalletClient;
  paymentClient: X402PaymentClient;
  attestationClient: AttestationClient;
  config: SessionRunnerConfig;
}

export interface AskInput {
  question: string;
  preId?: string;
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
  const id = input.preId ?? `q_${randomUUID()}`;
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
    attestation: null,
  };
  deps.store.insertQuerySession(session);
  deps.eventBus.emit('QUERY_SESSION_STARTED', { sessionId: id, question: input.question });

  // Memory dedup: check if a similar question was answered recently.
  // If so, return a synthesized session from memory without any paid calls.
  try {
    const hit = await checkDedup(deps.store, input.question);
    if (hit) {
      const fromMemorySynthesis: ResearchSynthesis = {
        verdict: `[From memory, ${Math.round(hit.similarity * 100)}% match] ${hit.verdict}`,
        confidence: hit.confidenceScore >= 0.7 ? 'high' : hit.confidenceScore >= 0.4 ? 'medium' : 'low',
        confidenceScore: hit.confidenceScore,
        summary: `Celina answered a similar question ${Math.round((Date.now() - hit.cachedAt) / 60000)} minutes ago (${hit.method} similarity ${Math.round(hit.similarity * 100)}%). Returning cached verdict. Original session: ${hit.sessionId}.`,
        keyFacts: [`Matched via ${hit.method}`, `Similarity: ${Math.round(hit.similarity * 100)}%`, `Previous cost: ${(Number(hit.totalSpent) / 1e6).toFixed(4)} USDG`],
        contradictions: [],
        callGrades: [],
      };
      session.synthesis = fromMemorySynthesis;
      session.status = 'done';
      session.completedAt = Date.now();
      session.totalSpent = '0';
      persist(deps, session);
      deps.eventBus.emit('QUERY_SESSION_DONE', {
        sessionId: id,
        verdict: fromMemorySynthesis.verdict,
        confidence: fromMemorySynthesis.confidence,
        confidenceScore: fromMemorySynthesis.confidenceScore,
        contradictions: 0,
        totalSpent: '0',
      });
      return session;
    }
  } catch {
    // Dedup check failures are non-fatal. Continue with fresh research.
  }

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
      const serviceStats = deps.store.getServiceStats();
      const { step: nextStep } = await deps.reasoner.planStep({
        question: session.question,
        calls: session.calls,
        totalSpent: session.totalSpent,
        maxCalls: deps.config.maxCalls,
        budgetUsdg: deps.config.budgetUsdg,
        serviceStats: serviceStats.length > 0 ? serviceStats : undefined,
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
      confidence: step.confidence,
      expectedValue: step.expectedValue,
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

    const call = await callPaidService(deps, service, args, {
      planReason: step.reason,
      planConfidence: step.confidence,
      planExpectedValue: step.expectedValue,
    });
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

  // Attach per-call grades produced by the synthesize tool so the dashboard
  // can show which paid calls were retrospectively worth their USDG. The
  // synthesize tool is instructed to emit one grade per input call in order,
  // but the LLM occasionally skips a call; we pair by index and fall back to
  // a name match so a drift doesn't lose all grades.
  for (let i = 0; i < session.calls.length; i++) {
    const call = session.calls[i]!;
    const byIndex = synthesis.callGrades[i];
    const match =
      byIndex && byIndex.service === call.service
        ? byIndex
        : synthesis.callGrades.find((g) => g.service === call.service) ?? null;
    call.grade = match;
  }

  session.synthesis = synthesis;

  // Attest the verdict on-chain. Failures are non-fatal: we record the error
  // in session.error so the dashboard can surface it but the session still
  // completes with a full synthesis for the user.
  try {
    const attestedAt = Date.now();
    const canonicalPayload = buildCanonicalVerdict({
      sessionId: session.id,
      question: session.question,
      synthesis,
      totalSpentMinimal: session.totalSpent,
      timestamp: attestedAt,
    });
    const canonicalJson = canonicalStringify(canonicalPayload);
    const sessionHash = deps.attestationClient.hashSessionId(session.id);
    const verdictHash = deps.attestationClient.hashVerdictPayload(canonicalJson);
    const sig = await deps.attestationClient.signVerdict(canonicalJson);
    const attestResult = await deps.attestationClient.attest({
      sessionHash,
      verdictHash,
      verdict: synthesis.verdict,
    });
    session.attestation = {
      sessionHash,
      verdictHash,
      signature: sig.signature,
      signer: sig.signer,
      txHash: attestResult.txHash,
      contractAddress: deps.config.celinaAttestationAddress,
      attestedAt,
    };
  } catch (err) {
    const errMsg = `attestation failed: ${(err as Error).message}`;
    session.error = session.error ? `${session.error} | ${errMsg}` : errMsg;
  }

  session.status = 'done';
  session.completedAt = Date.now();
  persist(deps, session);

  // Record call grades to service_performance so the planner can bias toward
  // high-performing services in future sessions.
  const gradedCalls = session.calls.filter((c) => c.grade !== null);
  if (gradedCalls.length > 0) {
    try {
      deps.store.recordServiceGrades(
        gradedCalls.map((c) => ({ service: c.service, usefulness: c.grade!.usefulness }))
      );
    } catch {
      // Non-fatal: learning table update failures should not break the session.
    }
  }

  // Persist verdict to session memory so future similar questions can be
  // answered from cache without paying for new research.
  if (synthesis.verdict && synthesis.confidenceScore >= 0.4) {
    persistToMemory(deps.store, {
      sessionId: session.id,
      question: session.question,
      verdict: synthesis.verdict,
      confidenceScore: synthesis.confidenceScore,
      totalSpent: session.totalSpent,
    }).catch(() => {
      // Non-fatal: memory persistence failure should not break the session.
    });
  }
  deps.eventBus.emit('QUERY_SESSION_DONE', {
    sessionId: id,
    verdict: synthesis.verdict,
    confidence: synthesis.confidence,
    confidenceScore: synthesis.confidenceScore,
    contradictions: synthesis.contradictions.length,
    totalSpent: session.totalSpent,
  });
  return session;
}

interface PlanAnnotation {
  planReason: string;
  planConfidence: number;
  planExpectedValue: string;
}

async function callPaidService(
  deps: SessionRunnerDeps,
  service: ResearchServiceName,
  args: Record<string, unknown>,
  plan: PlanAnnotation
): Promise<ResearchCall> {
  const startedAt = Date.now();
  const meta = RESEARCH_SERVICE_CATALOG[service];
  // The catalog's `provider` field decides which upstream URL to hit.
  // Producer hosts the raw OKX-tool services; Sub-agent hosts the
  // composed services that themselves pay the Producer via x402 under
  // Account 3 (agent-to-agent x402 chain).
  const baseUrl =
    meta.provider === 'subagent' ? deps.config.subagentUrl : deps.config.producerUrl;
  const url = `${baseUrl}${meta.path}`;

  const base: ResearchCall = {
    service,
    args,
    amountSpent: '0',
    txHash: null,
    data: null,
    error: null,
    startedAt,
    durationMs: 0,
    planReason: plan.planReason,
    planConfidence: plan.planConfidence,
    planExpectedValue: plan.planExpectedValue,
    grade: null,
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
    attestation: session.attestation ?? null,
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
