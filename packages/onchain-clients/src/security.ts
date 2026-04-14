import {
  TokenScanEnvelopeSchema,
  TxScanEnvelopeSchema,
  ApprovalsEnvelopeSchema,
  DappScanEnvelopeSchema,
  type TokenRiskReport,
  type TxScanReport,
  type ApprovalsPage,
  type DappScanReport,
} from '@x402/shared';
import { spawnCli } from './util/spawn-cli';

/**
 * Wrapper for `onchainos security` CLI commands (from okx-security skill).
 * Four commands exposed:
 *   - tokenScan: batch token risk flags (honeypot, taxes, mint auth, etc.)
 *   - txScan:    EVM pre-execution simulator + risk items + warnings
 *   - approvals: paginated permit2 / ERC-20 approvals list
 *   - dappScan:  phishing / blacklist check for a URL or domain
 *
 * Envelope shape differs per command (captured live 2026-04-15 via
 * scripts/src/spikes/security-spike.ts). token-scan + approvals return
 * data as array; tx-scan + dapp-scan return data as single object.
 */
export class SecurityClient {
  async tokenScan(params: {
    chainId: string;
    tokenAddress: string;
  }): Promise<TokenRiskReport | null> {
    const result = await spawnCli('onchainos', [
      'security',
      'token-scan',
      '--tokens',
      `${params.chainId}:${params.tokenAddress}`,
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`security token-scan failed: ${result.stderr}`);
    }
    const envelope = TokenScanEnvelopeSchema.parse(result.parseJson());
    if (!envelope.ok) {
      throw new Error(`security token-scan returned ok=false`);
    }
    return envelope.data[0] ?? null;
  }

  async txScan(params: {
    from: string;
    to: string;
    chain: string;
    data: string;
    value?: string;
  }): Promise<TxScanReport> {
    const result = await spawnCli('onchainos', [
      'security',
      'tx-scan',
      '--from',
      params.from,
      '--to',
      params.to,
      '--chain',
      params.chain,
      '--data',
      params.data,
      '--value',
      params.value ?? '0x0',
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`security tx-scan failed: ${result.stderr}`);
    }
    const envelope = TxScanEnvelopeSchema.parse(result.parseJson());
    if (!envelope.ok) {
      throw new Error(`security tx-scan returned ok=false`);
    }
    return envelope.data;
  }

  async approvals(params: {
    address: string;
    chain: string;
    limit?: number;
    cursor?: string;
  }): Promise<ApprovalsPage> {
    const args = [
      'security',
      'approvals',
      '--address',
      params.address,
      '--chain',
      params.chain,
      '--limit',
      String(params.limit ?? 20),
    ];
    if (params.cursor) {
      args.push('--cursor', params.cursor);
    }
    const result = await spawnCli('onchainos', args);
    if (result.exitCode !== 0) {
      throw new Error(`security approvals failed: ${result.stderr}`);
    }
    const envelope = ApprovalsEnvelopeSchema.parse(result.parseJson());
    if (!envelope.ok) {
      throw new Error(`security approvals returned ok=false`);
    }
    const page = envelope.data[0];
    if (!page) {
      throw new Error(`security approvals returned empty data array`);
    }
    return page;
  }

  async dappScan(domain: string): Promise<DappScanReport> {
    const result = await spawnCli('onchainos', [
      'security',
      'dapp-scan',
      '--domain',
      domain,
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`security dapp-scan failed: ${result.stderr}`);
    }
    const envelope = DappScanEnvelopeSchema.parse(result.parseJson());
    if (!envelope.ok) {
      throw new Error(`security dapp-scan returned ok=false`);
    }
    return envelope.data;
  }
}
