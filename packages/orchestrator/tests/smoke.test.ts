import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate, Store, EventBus, transition, initialContext } from '../src/index';

describe('Orchestrator smoke integration', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
  });

  it('simulates full cycle IDLE to COMPLETED end-to-end', () => {
    const store = new Store(db);
    const bus = new EventBus(db, 'orchestrator');
    const ctx = initialContext();

    store.insertCycle({ cycleNumber: 1, startedAt: Date.now() });
    store.updateCycleState(1, transition('IDLE', { type: 'LOOP_START' }, ctx).nextState);
    bus.emit('LOOP_CYCLE_STARTED', { cycleNumber: 1 });

    store.insertDecision({
      cycleNumber: 1,
      timestamp: Date.now(),
      action: 'consume_service',
      reason: 'need price',
      llmResponse: '{}',
      model: 'llama-3.3-70b-versatile',
      latencyMs: 800,
    });
    store.updateCycleState(1, transition('DECIDING', { type: 'LLM_RESPONSE' }, ctx).nextState);

    store.insertPendingPayment({
      cycleNumber: 1,
      scheme: 'exact',
      nonce: '0xNONCE1',
      fromAddr: '0xFROM',
      toAddr: '0xTO',
      amountMinimal: '10000',
      asset: '0xUSDG',
      service: 'market-snapshot',
      signedAt: Date.now(),
    });
    store.updateCycleState(1, transition('SIGNING', { type: 'PAYMENT_PROOF_READY' }, ctx).nextState);

    store.updateCycleState(1, transition('REPLAYING', { type: 'HTTP_200' }, ctx).nextState);
    store.updateVerification('0xNONCE1', Date.now());
    store.updateCycleState(1, transition('VERIFYING', { type: 'VERIFY_OK' }, ctx).nextState);

    store.updateSettlement('0xNONCE1', {
      txHash: '0xTXHASH',
      settledAt: Date.now(),
      status: 'settled',
    });
    const t6 = transition('SETTLING', { type: 'SETTLE_OK' }, ctx);
    expect(t6.nextState).toBe('COMPLETED');

    store.completeCycle(1, { completedAt: Date.now(), netUsdgChange: '0.01' });
    bus.emit('LOOP_CYCLE_COMPLETED', { cycleNumber: 1, netUsdgChange: '0.01' });

    const final = store.getCycle(1);
    expect(final?.state).toBe('COMPLETED');
    expect(final?.net_usdg_change).toBe('0.01');

    const payment = store.findPaymentByNonce('0xNONCE1');
    expect(payment?.status).toBe('settled');
    expect(payment?.tx_hash).toBe('0xTXHASH');

    const events = bus.replay({ sinceId: 0, limit: 100 });
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain('LOOP_CYCLE_STARTED');
    expect(kinds).toContain('LOOP_CYCLE_COMPLETED');
  });
});
