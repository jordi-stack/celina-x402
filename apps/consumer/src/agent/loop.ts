import type Database from 'better-sqlite3';
import type { Store, EventBus } from '@x402/orchestrator';
import { transition, initialContext } from '@x402/orchestrator';
import type { ServiceName } from '@x402/shared';
import type { WalletClient, X402PaymentClient } from '@x402/onchain-clients';
import type { ReasonerClient } from '../reasoner/client';
import type { ModelThrottler } from '../reasoner/throttler';
import type { BudgetTracker } from './budget';
import { parseChallenge402, replayWithPayment } from '../http/replay';
import { config } from '../config';

// Canonical demo payloads keyed by service name. These are used for every cycle
// so the loop remains self-contained (no per-cycle parameter generation).
const SERVICE_BODIES: Record<ServiceName, Record<string, string>> = {
  'market-snapshot': {
    tokenContractAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
  },
  'trench-scan': {
    tokenAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
  },
  'swap-quote': {
    fromTokenAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
    toTokenAddress: '0x779ded0c9e1022225f8e0630b35a9b54be713736',
    amount: '1000000',
    slippage: '0.005',
  },
};

export interface LoopDependencies {
  db: Database.Database;
  store: Store;
  eventBus: EventBus;
  reasoner: ReasonerClient;
  throttler: ModelThrottler;
  budget: BudgetTracker;
  walletClient: WalletClient;
  paymentClient: X402PaymentClient;
}

export async function runLoop(deps: LoopDependencies): Promise<void> {
  const ctx = initialContext();
  let cycleNumber = (deps.store.getCurrentCycle()?.cycle_number ?? 0) + 1;
  const cycleIntervalMs = Math.floor(60_000 / config.targetCyclesPerMin);

  while (true) {
    try {
    const startedAt = Date.now();

    // Idempotent cycle creation. Retries (HTTP_402 -> DECIDING) re-enter with
    // the same cycleNumber; a blind insertCycle would violate PRIMARY KEY.
    const existing = deps.store.getCycle(cycleNumber);
    if (!existing) {
      // Fresh cycle: reset retry counters so stale state from prior cycles does
      // not leak into this one.
      ctx.cycleRetryCount = 0;
      ctx.stateRetryCount = 0;
      ctx.previousState = 'IDLE';
      deps.store.insertCycle({ cycleNumber, startedAt });
      deps.store.updateCycleState(
        cycleNumber,
        transition('IDLE', { type: 'LOOP_START' }, ctx).nextState
      );
      deps.eventBus.emit('LOOP_CYCLE_STARTED', { cycleNumber });
    }

    // 1. Switch to Consumer account, fetch USDG balance
    await deps.walletClient.switchAccount(config.consumerAccountId);
    const balanceRaw = (await deps.walletClient.balance({
      chain: 'xlayer',
      tokenAddress: config.usdgContract,
    })) as { details?: Array<{ tokenAssets?: Array<{ balance?: string }> }> };
    const balanceUsdg = Number(
      balanceRaw.details?.[0]?.tokenAssets?.[0]?.balance ?? '0'
    );

    // 2. Reason via Groq
    let decision;
    try {
      decision = await deps.reasoner.reason({
        balanceUsdg,
        recentEarnings: deps.budget.recentEarnings(),
        recentSpends: deps.budget.recentSpends(),
        cycleNumber,
        minBalanceUsdg: config.minBalanceUsdg,
      });
      deps.throttler.reportSuccess();
    } catch (err) {
      if ((err as { status?: number }).status === 429) {
        deps.throttler.reportRateLimit();
        deps.store.updateCycleState(
          cycleNumber,
          transition('DECIDING', { type: 'LLM_429' }, ctx).nextState
        );
      } else {
        deps.store.updateCycleState(
          cycleNumber,
          transition('DECIDING', { type: 'LLM_TIMEOUT' }, ctx).nextState
        );
      }
      await sleep(cycleIntervalMs);
      cycleNumber++;
      continue;
    }

    deps.store.insertDecision({
      cycleNumber,
      timestamp: Date.now(),
      action: decision.action,
      reason: decision.reason,
      llmResponse: JSON.stringify(decision),
      model: deps.throttler.currentModel(),
      latencyMs: 0,
    });
    deps.eventBus.emit('DECISION_MADE', {
      cycleNumber,
      action: decision.action,
      service: decision.service ?? null,
      reason: decision.reason,
    });
    deps.store.updateCycleState(
      cycleNumber,
      transition('DECIDING', { type: 'LLM_RESPONSE' }, ctx).nextState
    );

    // 3. Skip if not a service consumption decision
    if (decision.action !== 'consume_service' || !decision.service) {
      deps.store.completeCycle(cycleNumber, {
        completedAt: Date.now(),
        netUsdgChange: '0',
      });
      deps.eventBus.emit('LOOP_CYCLE_COMPLETED', { cycleNumber, netUsdgChange: '0' });
      await sleep(cycleIntervalMs);
      cycleNumber++;
      continue;
    }

    const serviceName: ServiceName = decision.service;
    const url = `${config.producerUrl}/v1/${serviceName}`;
    const body = SERVICE_BODIES[serviceName];

    // 4. Fetch 402 challenge
    const challengeRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (challengeRes.status !== 402) {
      deps.store.updateCycleState(
        cycleNumber,
        transition('SIGNING', { type: 'CLI_ERROR' }, ctx).nextState
      );
      await sleep(cycleIntervalMs);
      cycleNumber++;
      continue;
    }

    const challengeHeader = challengeRes.headers.get('PAYMENT-REQUIRED');
    if (!challengeHeader) {
      await sleep(cycleIntervalMs);
      cycleNumber++;
      continue;
    }

    const challenge = parseChallenge402(challengeHeader);
    const accept = challenge.accepts[0]!;

    // 5. Sign via onchainos x402-pay CLI
    let proof;
    try {
      proof = await deps.paymentClient.signPayment({ accepts: challenge.accepts });
      deps.store.updateCycleState(
        cycleNumber,
        transition('SIGNING', { type: 'PAYMENT_PROOF_READY' }, ctx).nextState
      );
    } catch (err) {
      console.error(`[cycle ${cycleNumber}] sign error:`, (err as Error).message);
      deps.store.updateCycleState(
        cycleNumber,
        transition('SIGNING', { type: 'CLI_ERROR' }, ctx).nextState
      );
      await sleep(cycleIntervalMs);
      cycleNumber++;
      continue;
    }

    // 6. Replay with payment header
    const replayResult = await replayWithPayment({ url, body, accept, proof });

    if (replayResult.status === 200) {
      deps.budget.addSpend(serviceName, accept.amount, Date.now());
      deps.store.updateCycleState(
        cycleNumber,
        transition('REPLAYING', { type: 'HTTP_200' }, ctx).nextState
      );
      ctx.previousState = 'REPLAYING';
      ctx.cycleRetryCount = 0;

      // 7. Poll SQLite payments table for Producer-side settlement
      const nonce = proof.authorization.nonce;
      const settled = await waitForSettlement(deps.store, nonce, 30_000);

      if (settled && settled.tx_hash) {
        deps.store.updateCycleState(
          cycleNumber,
          transition('VERIFYING', { type: 'VERIFY_OK' }, ctx).nextState
        );
        deps.store.updateCycleState(
          cycleNumber,
          transition('SETTLING', { type: 'SETTLE_OK' }, ctx).nextState
        );
        deps.store.completeCycle(cycleNumber, {
          completedAt: Date.now(),
          netUsdgChange: `-${accept.amount}`,
        });
        deps.eventBus.emit('SERVICE_CONSUMED', {
          cycleNumber,
          service: serviceName,
          amount: accept.amount,
          txHash: settled.tx_hash,
        });
        deps.eventBus.emit('LOOP_CYCLE_COMPLETED', {
          cycleNumber,
          netUsdgChange: `-${accept.amount}`,
        });
      } else {
        deps.store.updateCycleState(
          cycleNumber,
          transition('SETTLING', { type: 'SETTLE_TIMEOUT' }, ctx).nextState
        );
        deps.eventBus.emit('LOOP_CYCLE_FAILED', {
          cycleNumber,
          reason: 'settlement timeout',
        });
      }
    } else if (replayResult.status === 402) {
      ctx.cycleRetryCount += 1;
      const retryResult = transition('REPLAYING', { type: 'HTTP_402' }, ctx);
      deps.store.updateCycleState(cycleNumber, retryResult.nextState);
      if (retryResult.nextState === 'DECIDING') {
        continue;
      }
    } else {
      deps.store.updateCycleState(
        cycleNumber,
        transition('REPLAYING', { type: 'HTTP_500' }, ctx).nextState
      );
    }

    await sleep(cycleIntervalMs);
    cycleNumber++;
    } catch (err) {
      console.error(`[cycle ${cycleNumber}] transient error:`, (err as Error).message);
      await sleep(cycleIntervalMs);
      cycleNumber++;
    }
  }
}

/**
 * Poll SQLite payments table by nonce until settlement lands or timeout elapses.
 * Producer and Consumer share the same SQLite file, so the Producer's
 * onResponse hook writing status='settled' is visible to Consumer via this poll.
 */
async function waitForSettlement(
  store: Store,
  nonce: string,
  timeoutMs: number
): Promise<{ tx_hash: string | null; status: string } | null> {
  const start = Date.now();
  const pollInterval = 500;
  while (Date.now() - start < timeoutMs) {
    const payment = store.findPaymentByNonce(nonce);
    if (payment && payment.status === 'settled' && payment.tx_hash) {
      return { tx_hash: payment.tx_hash, status: payment.status };
    }
    if (payment && payment.status === 'settle_failed') {
      return null;
    }
    await sleep(pollInterval);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
