import { spawnCli, type SpawnCliResult } from './util/spawn-cli';

export interface WalletStatus {
  email: string;
  loggedIn: boolean;
  currentAccountId: string;
  currentAccountName: string;
  accountCount: number;
  policy: Record<string, unknown> | null;
}

export interface BalanceOptions {
  chain: string;
  tokenAddress?: string;
  all?: boolean;
}

export interface SendTokenOptions {
  chain: string;
  recipient: string;
  readableAmount: string;
  contractToken?: string;
  from?: string;
  force?: boolean;
}

export interface SendTokenResult {
  txHash: string;
}

export interface HistoryOptions {
  accountId?: string;
  chain: string;
  txHash?: string;
  address?: string;
  limit?: string;
}

export interface HistoryEntry {
  txHash: string;
  txStatus: string;
  txTime: string;
  from: string;
  to: string;
  direction: 'send' | 'receive';
  coinSymbol: string;
  coinAmount: string;
}

/**
 * The onchainos CLI wraps all wallet subcommand output in an envelope:
 *   { "ok": boolean, "data": T, "error"?: string }
 *
 * Parse the envelope and return `data`, or throw if `ok: false`.
 *
 * Accepts either a pre-wrapped envelope or a bare payload so that unit tests
 * which mock stdout with the unwrapped shape still work.
 */
function unwrapEnvelope<T>(result: SpawnCliResult, operation: string): T {
  const parsed = result.parseJson<{ ok?: boolean; data?: T; error?: string } | T>();
  if (
    parsed !== null &&
    typeof parsed === 'object' &&
    'ok' in parsed &&
    typeof (parsed as { ok?: unknown }).ok === 'boolean'
  ) {
    const env = parsed as { ok: boolean; data?: T; error?: string };
    if (!env.ok) {
      throw new Error(`${operation} failed: ${env.error ?? 'unknown error'}`);
    }
    if (env.data === undefined) {
      throw new Error(`${operation} returned no data`);
    }
    return env.data;
  }
  return parsed as T;
}

/**
 * TypeScript wrapper around `onchainos wallet` CLI commands.
 * All methods invoke spawnCli with canonical arg arrays, unwrap the
 * `{ok, data}` envelope, and return the typed inner payload.
 * Throws on non-zero exit codes or envelope `ok: false`.
 */
export class WalletClient {
  async status(): Promise<WalletStatus> {
    const result = await spawnCli('onchainos', ['wallet', 'status'], {});
    if (result.exitCode !== 0) {
      throw new Error(`wallet status failed: ${result.stderr || 'unknown error'}`);
    }
    return unwrapEnvelope<WalletStatus>(result, 'wallet status');
  }

  async switchAccount(accountId: string): Promise<void> {
    const result = await spawnCli('onchainos', ['wallet', 'switch', accountId], {});
    if (result.exitCode !== 0) {
      throw new Error(`wallet switch failed: ${result.stderr}`);
    }
  }

  async addAccount(): Promise<{ accountId: string; accountName: string }> {
    const result = await spawnCli('onchainos', ['wallet', 'add'], {});
    if (result.exitCode !== 0) {
      throw new Error(`wallet add failed: ${result.stderr}`);
    }
    return unwrapEnvelope<{ accountId: string; accountName: string }>(result, 'wallet add');
  }

  async balance(opts: BalanceOptions): Promise<unknown> {
    const args: string[] = ['wallet', 'balance'];
    if (opts.all) args.push('--all');
    if (opts.chain) args.push('--chain', opts.chain);
    if (opts.tokenAddress) args.push('--token-address', opts.tokenAddress);
    const result = await spawnCli('onchainos', args, {});
    if (result.exitCode !== 0) {
      throw new Error(`wallet balance failed: ${result.stderr}`);
    }
    return unwrapEnvelope<unknown>(result, 'wallet balance');
  }

  async sendToken(opts: SendTokenOptions): Promise<SendTokenResult> {
    const args: string[] = [
      'wallet',
      'send',
      '--chain',
      opts.chain,
      '--recipient',
      opts.recipient,
      '--readable-amount',
      opts.readableAmount,
    ];
    if (opts.contractToken) args.push('--contract-token', opts.contractToken);
    if (opts.from) args.push('--from', opts.from);
    if (opts.force) args.push('--force');
    const result = await spawnCli('onchainos', args, {});
    if (result.exitCode !== 0) {
      throw new Error(`wallet send failed: ${result.stderr}`);
    }
    return unwrapEnvelope<SendTokenResult>(result, 'wallet send');
  }

  async getHistory(opts: HistoryOptions): Promise<HistoryEntry[]> {
    const args: string[] = ['wallet', 'history', '--chain', opts.chain];
    if (opts.accountId) args.push('--account-id', opts.accountId);
    if (opts.txHash) args.push('--tx-hash', opts.txHash);
    if (opts.address) args.push('--address', opts.address);
    if (opts.limit) args.push('--limit', opts.limit);
    const result = await spawnCli('onchainos', args, {});
    if (result.exitCode !== 0) {
      throw new Error(`wallet history failed: ${result.stderr}`);
    }
    const data = unwrapEnvelope<Array<{ orderList: HistoryEntry[] }>>(result, 'wallet history');
    return data[0]?.orderList ?? [];
  }
}
