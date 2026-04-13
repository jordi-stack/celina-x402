import type { Store, PaymentRow } from '../db/store';

export interface WalletHistoryEntry {
  txHash: string;
  nonce: string;
  timestamp: number;
}

export type WalletHistoryFetcher = () => Promise<WalletHistoryEntry[]>;

export interface ReconcileResult {
  reconciled: PaymentRow[];
  abandoned: PaymentRow[];
  stillPending: PaymentRow[];
}

export interface ReconcileOpts {
  store: Store;
  fetchWalletHistory: WalletHistoryFetcher;
  nowMs: number;
  orphanThresholdMs?: number;
}

/**
 * Reconcile non-terminal payments against on-chain wallet history.
 * Spec Section 4.2 reconciliation flow.
 *
 * Matching strategy: nonce-keyed lookup only (step 4 primary path).
 * The spec also allows fallback matching by amount + from_addr + timestamp window.
 * That fallback is the responsibility of the WalletHistoryFetcher implementation
 * in Chunk 3. The fetcher is expected to pre-filter wallet history and attach
 * synthetic nonces for payments whose on-chain tx cannot be directly tagged.
 *
 * Recovery intentionally bypasses the state machine by calling updateCycleState
 * directly (out-of-band transition). This is acceptable because reconciliation
 * runs only at boot before the state machine processes any events.
 *
 * Early-exit optimization: if findNonTerminalPayments returns empty, we never
 * call fetchWalletHistory. The test "skips already-terminal cycles" verifies
 * the mock is not invoked in that case.
 */
export async function reconcileOnBoot(opts: ReconcileOpts): Promise<ReconcileResult> {
  const orphanThresholdMs = opts.orphanThresholdMs ?? 60_000;
  const result: ReconcileResult = { reconciled: [], abandoned: [], stillPending: [] };

  const pending = opts.store.findNonTerminalPayments();
  if (pending.length === 0) return result;

  const history = await opts.fetchWalletHistory();
  const historyByNonce = new Map<string, WalletHistoryEntry>();
  for (const entry of history) {
    historyByNonce.set(entry.nonce, entry);
  }

  for (const payment of pending) {
    const match = historyByNonce.get(payment.nonce);
    if (match) {
      opts.store.updateSettlement(payment.nonce, {
        txHash: match.txHash,
        settledAt: match.timestamp,
        status: 'settled',
      });
      opts.store.completeCycle(payment.cycle_number, {
        completedAt: match.timestamp,
        netUsdgChange: payment.amount_minimal,
      });
      result.reconciled.push(payment);
    } else if (opts.nowMs - payment.signed_at > orphanThresholdMs) {
      opts.store.updateSettlement(payment.nonce, {
        txHash: null,
        settledAt: opts.nowMs,
        status: 'settle_abandoned',
      });
      opts.store.updateCycleState(payment.cycle_number, 'FAILED');
      result.abandoned.push(payment);
    } else {
      result.stillPending.push(payment);
    }
  }

  return result;
}
