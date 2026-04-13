import { spawnCli } from './util/spawn-cli';

export interface DevHoldingInfo {
  address: string;
  rugPullCount: number;
  createdTokenCount?: number;
}

export interface TokenDevInfoResult {
  devHoldingInfo: DevHoldingInfo | null;
}

export interface BundleInfoResult {
  bundleDetected: boolean;
  sniperCount: number;
  bundledBuyCount?: number;
}

/**
 * Wrapper for `onchainos memepump` CLI commands (from okx-dex-trenches skill).
 * Used by Producer's trench-scan service to assess token dev reputation.
 */
export class TrenchesClient {
  async tokenDevInfo(tokenAddress: string): Promise<TokenDevInfoResult> {
    const result = await spawnCli('onchainos', [
      'memepump',
      'token-dev-info',
      '--address',
      tokenAddress,
    ], {});
    if (result.exitCode !== 0) {
      throw new Error(`memepump token-dev-info failed: ${result.stderr}`);
    }
    return result.parseJson<TokenDevInfoResult>();
  }

  async bundleInfo(tokenAddress: string): Promise<BundleInfoResult> {
    const result = await spawnCli('onchainos', [
      'memepump',
      'token-bundle-info',
      '--address',
      tokenAddress,
    ], {});
    if (result.exitCode !== 0) {
      throw new Error(`memepump token-bundle-info failed: ${result.stderr}`);
    }
    return result.parseJson<BundleInfoResult>();
  }
}
