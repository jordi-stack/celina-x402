import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate';
import { Store } from '../../src/db/store';
import { reconcileOnBoot, type WalletHistoryFetcher } from '../../src/recovery/reconcile';

describe('reconcileOnBoot', () => {
  let db: Database.Database;
  let store: Store;

  beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
    store = new Store(db);
  });

  it('marks cycle COMPLETED when on-chain tx matches pending payment nonce', async () => {
    store.insertCycle({ cycleNumber: 1, startedAt: 100 });
    store.insertPendingPayment({
      cycleNumber: 1,
      scheme: 'exact',
      nonce: '0xNONCE1',
      fromAddr: '0xFROM',
      toAddr: '0xTO',
      amountMinimal: '10000',
      asset: '0xUSDG',
      service: 'market-snapshot',
      signedAt: 100,
    });

    const fetchWalletHistory: WalletHistoryFetcher = vi.fn().mockResolvedValue([
      { txHash: '0xTX_FOUND', nonce: '0xNONCE1', timestamp: 150 },
    ]);

    const result = await reconcileOnBoot({ store, fetchWalletHistory, nowMs: 200 });

    expect(result.reconciled).toHaveLength(1);
    const payment = store.findPaymentByNonce('0xNONCE1');
    expect(payment?.status).toBe('settled');
    expect(payment?.tx_hash).toBe('0xTX_FOUND');
    expect(store.getCycle(1)?.state).toBe('COMPLETED');
  });

  it('marks payment settle_abandoned when no matching tx and >60s since signed', async () => {
    store.insertCycle({ cycleNumber: 1, startedAt: 100 });
    store.insertPendingPayment({
      cycleNumber: 1,
      scheme: 'exact',
      nonce: '0xORPHAN',
      fromAddr: '0xFROM',
      toAddr: '0xTO',
      amountMinimal: '10000',
      asset: '0xUSDG',
      service: 'market-snapshot',
      signedAt: 100,
    });
    const fetchWalletHistory: WalletHistoryFetcher = vi.fn().mockResolvedValue([]);
    const result = await reconcileOnBoot({ store, fetchWalletHistory, nowMs: 200_000 });
    expect(result.abandoned).toHaveLength(1);
    expect(store.findPaymentByNonce('0xORPHAN')?.status).toBe('settle_abandoned');
    expect(store.getCycle(1)?.state).toBe('FAILED');
  });

  it('leaves payment pending when no matching tx but <60s since signed', async () => {
    const signedAt = Date.now();
    store.insertCycle({ cycleNumber: 1, startedAt: signedAt });
    store.insertPendingPayment({
      cycleNumber: 1,
      scheme: 'exact',
      nonce: '0xRECENT',
      fromAddr: '0xFROM',
      toAddr: '0xTO',
      amountMinimal: '10000',
      asset: '0xUSDG',
      service: 'market-snapshot',
      signedAt,
    });
    const fetchWalletHistory: WalletHistoryFetcher = vi.fn().mockResolvedValue([]);
    const result = await reconcileOnBoot({ store, fetchWalletHistory, nowMs: signedAt + 30_000 });
    expect(result.stillPending).toHaveLength(1);
    expect(store.findPaymentByNonce('0xRECENT')?.status).toBe('signed');
  });

  it('skips already-terminal cycles', async () => {
    store.insertCycle({ cycleNumber: 1, startedAt: 100 });
    store.completeCycle(1, { completedAt: 200, netUsdgChange: '0.01' });
    store.insertPendingPayment({
      cycleNumber: 1,
      scheme: 'exact',
      nonce: '0xSETTLED',
      fromAddr: '0xFROM',
      toAddr: '0xTO',
      amountMinimal: '10000',
      asset: '0xUSDG',
      service: 'market-snapshot',
      signedAt: 100,
    });
    store.updateSettlement('0xSETTLED', { txHash: '0xTX', settledAt: 150, status: 'settled' });
    const fetchWalletHistory: WalletHistoryFetcher = vi.fn().mockResolvedValue([]);
    const result = await reconcileOnBoot({ store, fetchWalletHistory, nowMs: 10_000_000 });
    expect(result.reconciled).toHaveLength(0);
    expect(result.abandoned).toHaveLength(0);
    expect(fetchWalletHistory).not.toHaveBeenCalled();
  });
});
