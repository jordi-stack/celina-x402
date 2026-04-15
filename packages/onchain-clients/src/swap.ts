import { spawnCli } from './util/spawn-cli';
import { unwrapEnvelope } from './wallet';

export interface SwapQuoteEntry {
  fromTokenSymbol: string;
  toTokenSymbol: string;
  fromAmount: string;
  toAmount: string;
  priceImpactPercent: string;
  estimateGasFee: string;
  router: string;
}

export interface SwapExecResult {
  txHash: string;
  fromTokenSymbol: string;
  toTokenSymbol: string;
  fromAmount: string;
  toAmount: string;
  priceImpactPercent: string;
  router: string;
}

/**
 * Thin wrapper around `onchainos swap quote` and `onchainos swap execute`.
 * Both commands target the OKX DEX aggregator on the given chain.
 *
 * quote(): read-only price estimate — safe to call without spending funds.
 * execute(): one-shot quote→approve→swap→broadcast. The Producer wallet
 * must be selected before calling execute() (done at server boot via
 * WalletClient.switchAccount). The `walletAddress` param is the public
 * key of the active account; onchainos uses it for route optimisation
 * and slippage checks, not for re-auth.
 */
export class SwapClient {
  async quote(opts: {
    chain: string;
    fromToken: string;
    toToken: string;
    readableAmount: string;
  }): Promise<SwapQuoteEntry> {
    const result = await spawnCli(
      'onchainos',
      [
        'swap',
        'quote',
        '--chain', opts.chain,
        '--from', opts.fromToken,
        '--to', opts.toToken,
        '--readable-amount', opts.readableAmount,
      ],
      {}
    );
    if (result.exitCode !== 0) {
      throw new Error(`swap quote failed: ${result.stderr || result.stdout || 'unknown'}`);
    }
    // The CLI returns an array of route options; pick the first (best route
    // by OKX aggregator scoring).
    const rows = unwrapEnvelope<unknown[]>(result, 'swap-quote');
    const row = (Array.isArray(rows) ? rows[0] : rows) as {
      fromToken?: { tokenSymbol?: string };
      toToken?: { tokenSymbol?: string };
      fromTokenAmount?: string;
      toTokenAmount?: string;
      priceImpactPercent?: string;
      estimateGasFee?: string;
      router?: string;
    };
    return {
      fromTokenSymbol: row.fromToken?.tokenSymbol ?? opts.fromToken,
      toTokenSymbol: row.toToken?.tokenSymbol ?? opts.toToken,
      fromAmount: row.fromTokenAmount ?? '0',
      toAmount: row.toTokenAmount ?? '0',
      priceImpactPercent: row.priceImpactPercent ?? '0',
      estimateGasFee: row.estimateGasFee ?? '0',
      router: row.router ?? '',
    };
  }

  async execute(opts: {
    chain: string;
    fromToken: string;
    toToken: string;
    readableAmount: string;
    walletAddress: string;
    slippage?: string;
  }): Promise<SwapExecResult> {
    const args = [
      'swap',
      'execute',
      '--chain', opts.chain,
      '--from', opts.fromToken,
      '--to', opts.toToken,
      '--readable-amount', opts.readableAmount,
      '--wallet', opts.walletAddress,
    ];
    if (opts.slippage) args.push('--slippage', opts.slippage);

    const result = await spawnCli('onchainos', args, {});
    if (result.exitCode !== 0) {
      throw new Error(`swap execute failed: ${result.stderr || result.stdout || 'unknown'}`);
    }
    const data = unwrapEnvelope<{
      txHash?: string;
      fromToken?: { tokenSymbol?: string };
      toToken?: { tokenSymbol?: string };
      fromTokenAmount?: string;
      toTokenAmount?: string;
      priceImpactPercent?: string;
      router?: string;
    }>(result, 'swap-execute');

    if (!data.txHash) {
      throw new Error(`swap execute returned no txHash: ${JSON.stringify(data)}`);
    }
    return {
      txHash: data.txHash,
      fromTokenSymbol: data.fromToken?.tokenSymbol ?? opts.fromToken,
      toTokenSymbol: data.toToken?.tokenSymbol ?? opts.toToken,
      fromAmount: data.fromTokenAmount ?? '0',
      toAmount: data.toTokenAmount ?? '0',
      priceImpactPercent: data.priceImpactPercent ?? '0',
      router: data.router ?? '',
    };
  }
}
