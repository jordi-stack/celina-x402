import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate';
import { Store } from '../../src/db/store';

describe('Store', () => {
  let db: Database.Database;
  let store: Store;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    store = new Store(db);
  });

  describe('loop_cycles', () => {
    it('insertCycle creates a new cycle in IDLE state', () => {
      const cycle = store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      expect(cycle.cycle_number).toBe(1);
      expect(cycle.state).toBe('IDLE');
      expect(cycle.retry_count).toBe(0);
      expect(cycle.started_at).toBe(100);
    });

    it('updateCycleState transitions cycle state and appends to transitions log', () => {
      store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      store.updateCycleState(1, 'DECIDING');
      const cycle = store.getCycle(1);
      expect(cycle?.state).toBe('DECIDING');
      expect(cycle?.state_transitions).toContain('DECIDING');
    });

    it('getCurrentCycle returns the most recent cycle', () => {
      store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      store.insertCycle({ cycleNumber: 2, startedAt: 200 });
      store.insertCycle({ cycleNumber: 3, startedAt: 300 });
      expect(store.getCurrentCycle()?.cycle_number).toBe(3);
    });

    it('completeCycle sets completed_at and final state', () => {
      store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      store.completeCycle(1, { completedAt: 500, netUsdgChange: '0.01' });
      const cycle = store.getCycle(1);
      expect(cycle?.completed_at).toBe(500);
      expect(cycle?.state).toBe('COMPLETED');
      expect(cycle?.net_usdg_change).toBe('0.01');
    });
  });

  describe('payments', () => {
    it('insertPendingPayment creates a signed-status row', () => {
      store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      const payment = store.insertPendingPayment({
        cycleNumber: 1,
        scheme: 'exact',
        nonce: '0xABC123',
        fromAddr: '0xFROM',
        toAddr: '0xTO',
        amountMinimal: '10000',
        asset: '0xUSDG',
        service: 'market-snapshot',
        signedAt: 150,
      });
      expect(payment.id).toBeGreaterThan(0);
      expect(payment.status).toBe('signed');
      expect(payment.nonce).toBe('0xABC123');
    });

    it('updateSettlement sets tx_hash + status keyed by nonce', () => {
      store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      store.insertPendingPayment({
        cycleNumber: 1,
        scheme: 'exact',
        nonce: '0xABC123',
        fromAddr: '0xFROM',
        toAddr: '0xTO',
        amountMinimal: '10000',
        asset: '0xUSDG',
        service: 'market-snapshot',
        signedAt: 150,
      });
      store.updateSettlement('0xABC123', {
        txHash: '0xTXHASH',
        settledAt: 300,
        status: 'settled',
      });
      const payment = store.findPaymentByNonce('0xABC123');
      expect(payment?.tx_hash).toBe('0xTXHASH');
      expect(payment?.status).toBe('settled');
      expect(payment?.settled_at).toBe(300);
    });

    it('findNonTerminalPayments returns signed + verified rows', () => {
      store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      store.insertPendingPayment({
        cycleNumber: 1,
        scheme: 'exact',
        nonce: '0xA',
        fromAddr: '0x1',
        toAddr: '0x2',
        amountMinimal: '100',
        asset: '0xUSDG',
        service: 'market-snapshot',
        signedAt: 100,
      });
      store.insertPendingPayment({
        cycleNumber: 1,
        scheme: 'exact',
        nonce: '0xB',
        fromAddr: '0x1',
        toAddr: '0x2',
        amountMinimal: '200',
        asset: '0xUSDG',
        service: 'swap-quote',
        signedAt: 110,
      });
      store.updateSettlement('0xB', { txHash: '0xTX', settledAt: 200, status: 'settled' });
      const nonTerminal = store.findNonTerminalPayments();
      expect(nonTerminal).toHaveLength(1);
      expect(nonTerminal[0]?.nonce).toBe('0xA');
    });
  });

  describe('decisions', () => {
    it('insertDecision records LLM response', () => {
      store.insertCycle({ cycleNumber: 1, startedAt: 100 });
      store.insertDecision({
        cycleNumber: 1,
        timestamp: 150,
        action: 'consume_service',
        reason: 'Need price data before trade',
        llmResponse: '{"action":"consume_service","service":"market-snapshot"}',
        model: 'llama-3.3-70b-versatile',
        latencyMs: 850,
      });
      const decisions = store.getDecisionsByCycle(1);
      expect(decisions).toHaveLength(1);
      expect(decisions[0]?.action).toBe('consume_service');
      expect(decisions[0]?.latency_ms).toBe(850);
    });
  });

  describe('mcp_calls', () => {
    it('logMcpCall persists call with args+result', () => {
      store.logMcpCall({
        timestamp: 100,
        tool: 'dex-okx-dex-quote',
        args: { chainIndex: '196', amount: '1000000' },
        result: { toTokenAmount: '999000' },
        durationMs: 450,
        success: true,
      });
      const calls = store.getMcpCalls({ limit: 10 });
      expect(calls).toHaveLength(1);
      expect(calls[0]?.tool).toBe('dex-okx-dex-quote');
      expect(calls[0]?.success).toBe(true);
    });
  });
});
