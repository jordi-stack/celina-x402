import { WalletClient, type HistoryEntry } from './wallet';

export interface WalletHistoryEntry {
  txHash: string;
  nonce: string;
  timestamp: number;
}

export interface RecoveryAdapterOptions {
  accountId: string;
  chain: string;
  nonceResolver: (entry: HistoryEntry) => string;
  walletClient?: WalletClient;
}

/**
 * Creates a WalletHistoryFetcher compatible with @x402/orchestrator's reconcileOnBoot.
 *
 * Reads recent Producer-side receive events via `onchainos wallet history` and
 * maps each entry to a WalletHistoryEntry with a derived nonce.
 *
 * Nonce derivation is caller-provided via `nonceResolver` because the CLI does
 * not expose nonces in the history response. Callers must match against local
 * payments table (e.g., by amount + from + timestamp window, then attach nonce).
 *
 * Spec Section 4.2 step 4 reconciliation fallback.
 */
export function createWalletHistoryFetcher(
  opts: RecoveryAdapterOptions
): () => Promise<WalletHistoryEntry[]> {
  const client = opts.walletClient ?? new WalletClient();
  return async () => {
    const history = await client.getHistory({
      accountId: opts.accountId,
      chain: opts.chain,
    });
    return history
      .filter((entry) => entry.direction === 'receive')
      .map((entry) => ({
        txHash: entry.txHash,
        nonce: opts.nonceResolver(entry),
        timestamp: Number.parseInt(entry.txTime, 10),
      }));
  };
}
