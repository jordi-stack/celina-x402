import type { FastifyPluginAsync } from 'fastify';
import type { OKXMCPClient } from '@x402/mcp-client';
import type { SecurityClient, TrenchesClient } from '@x402/onchain-clients';
import type { Store } from '@x402/orchestrator';
import type { TokenRiskReport, TokenHolder, TokenPriceInfo } from '@x402/shared';

interface PluginOpts {
  mcpClient: OKXMCPClient;
  securityClient: SecurityClient;
  trenchesClient: TrenchesClient;
  store: Store;
}

// Flags that indicate a token is likely unsafe. Weight = 1 each.
// Picked from the 23-flag TokenRiskReport based on which are actionable red flags
// for a buyer (not noise like isChainSupported or isPump).
const RED_FLAG_KEYS = [
  'isHoneypot',
  'isRiskToken',
  'isMintable',
  'isAirdropScam',
  'isCounterfeit',
  'isDumping',
  'isFakeLiquidity',
  'isHasAssetEditAuth',
  'isHasFrozenAuth',
  'isLiquidityRemoval',
  'isLowLiquidity',
  'isNotRenounced',
  'isOverIssued',
  'isRubbishAirdrop',
  'isVeryHighLpHolderProp',
  'isVeryLowLpBurn',
  'isWash',
] as const satisfies readonly (keyof TokenRiskReport)[];

type Verdict = 'safe' | 'caution' | 'avoid';

interface TokenReportData {
  tokenAddress: string;
  chainIndex: '196';
  price: TokenPriceInfo | null;
  security: TokenRiskReport | null;
  dev: {
    address: string | null;
    rugPullCount: number;
    createdTokenCount: number | null;
    bundleDetected: boolean;
    sniperCount: number;
  };
  holders: {
    top10Percent: number;
    top1Percent: number;
    sampleSize: number;
  };
  signals: {
    redFlags: string[];
    riskScore: number;
    verdict: Verdict;
    reasons: string[];
  };
}

export const researchTokenReportRoute: FastifyPluginAsync<PluginOpts> = async (
  fastify,
  opts
) => {
  fastify.post(
    '/research/token-report',
    {
      config: {
        // 15000 minimal units = 0.015 USDG (6 decimals)
        x402: { amount: '15000', service: 'research-token-report' },
      },
      schema: {
        body: {
          type: 'object',
          required: ['tokenAddress'],
          properties: {
            tokenAddress: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
          },
        },
      },
    },
    async (request) => {
      const body = request.body as { tokenAddress: string };
      const token = body.tokenAddress.toLowerCase();
      const start = Date.now();

      const [priceRes, scanRes, devRes, bundleRes, holdersRes] =
        await Promise.allSettled([
          opts.mcpClient.getTokenPriceInfo({
            items: [{ chainIndex: '196', tokenContractAddress: token }],
          }),
          opts.securityClient.tokenScan({ chainId: '196', tokenAddress: token }),
          opts.trenchesClient.tokenDevInfo(token),
          opts.trenchesClient.bundleInfo(token),
          opts.mcpClient.getTokenHolders({
            chainIndex: '196',
            tokenContractAddress: token,
          }),
        ]);

      const price = unwrap(priceRes);
      const security = unwrap(scanRes);
      const devInfo = unwrap(devRes);
      const bundleInfo = unwrap(bundleRes);
      const holders = unwrap(holdersRes);

      logCall(opts.store, 'dex-okx-market-token-price-info', body, priceRes, start);
      logCall(opts.store, 'security-token-scan', body, scanRes, start);
      logCall(opts.store, 'memepump-token-dev-info', body, devRes, start);
      logCall(opts.store, 'memepump-token-bundle-info', body, bundleRes, start);
      logCall(opts.store, 'dex-okx-market-token-holder', body, holdersRes, start);

      const redFlags = collectRedFlags(security);
      const dev = {
        address: devInfo?.devHoldingInfo?.address ?? null,
        rugPullCount: devInfo?.devHoldingInfo?.rugPullCount ?? 0,
        createdTokenCount: devInfo?.devHoldingInfo?.createdTokenCount ?? null,
        bundleDetected: bundleInfo?.bundleDetected ?? false,
        sniperCount: bundleInfo?.sniperCount ?? 0,
      };
      const holderStats = summarizeHolders(holders);
      const { riskScore, verdict, reasons } = score({
        redFlags,
        dev,
        holders: holderStats,
        security,
      });

      const data: TokenReportData = {
        tokenAddress: token,
        chainIndex: '196',
        price,
        security,
        dev,
        holders: holderStats,
        signals: { redFlags, riskScore, verdict, reasons },
      };

      return { service: 'research-token-report', data, servedAt: Date.now() };
    }
  );
};

function unwrap<T>(res: PromiseSettledResult<T>): T | null {
  return res.status === 'fulfilled' ? res.value : null;
}

function logCall(
  store: Store,
  tool: string,
  args: Record<string, unknown>,
  res: PromiseSettledResult<unknown>,
  start: number
) {
  store.logMcpCall({
    timestamp: Date.now(),
    tool,
    args,
    result:
      res.status === 'fulfilled'
        ? res.value
        : { error: (res.reason as Error)?.message ?? String(res.reason) },
    durationMs: Date.now() - start,
    success: res.status === 'fulfilled',
  });
}

function collectRedFlags(security: TokenRiskReport | null): string[] {
  if (!security) return [];
  const flags: string[] = [];
  for (const key of RED_FLAG_KEYS) {
    if (security[key]) flags.push(key);
  }
  const buyTax = Number(security.buyTaxes);
  const sellTax = Number(security.sellTaxes);
  if (Number.isFinite(buyTax) && buyTax >= 0.1) flags.push('highBuyTax');
  if (Number.isFinite(sellTax) && sellTax >= 0.1) flags.push('highSellTax');
  return flags;
}

function summarizeHolders(holders: TokenHolder[] | null) {
  if (!holders || holders.length === 0) {
    return { top10Percent: 0, top1Percent: 0, sampleSize: 0 };
  }
  const top10 = holders
    .slice(0, 10)
    .reduce((sum, h) => sum + (Number(h.holdPercent) || 0), 0);
  const top1 = Number(holders[0]?.holdPercent) || 0;
  return {
    top10Percent: round(top10),
    top1Percent: round(top1),
    sampleSize: holders.length,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function score(input: {
  redFlags: string[];
  dev: { rugPullCount: number; bundleDetected: boolean; sniperCount: number };
  holders: { top10Percent: number; top1Percent: number };
  security: TokenRiskReport | null;
}): { riskScore: number; verdict: Verdict; reasons: string[] } {
  let s = 0;
  const reasons: string[] = [];

  if (input.security?.isHoneypot) {
    s += 100;
    reasons.push('honeypot flag set');
  }
  if (input.security?.isRiskToken) {
    s += 40;
    reasons.push('marked as risk token');
  }
  const nonHoneypotFlags = input.redFlags.filter(
    (f) => f !== 'isHoneypot' && f !== 'isRiskToken'
  );
  if (nonHoneypotFlags.length > 0) {
    s += nonHoneypotFlags.length * 8;
    reasons.push(`${nonHoneypotFlags.length} security red flags`);
  }

  if (input.dev.rugPullCount >= 3) {
    s += 60;
    reasons.push(`dev has ${input.dev.rugPullCount} prior rugpulls`);
  } else if (input.dev.rugPullCount >= 1) {
    s += 25;
    reasons.push(`dev has ${input.dev.rugPullCount} prior rugpull(s)`);
  }
  if (input.dev.bundleDetected) {
    s += 15;
    reasons.push('bundle launch detected');
  }
  if (input.dev.sniperCount > 10) {
    s += 15;
    reasons.push(`${input.dev.sniperCount} snipers at launch`);
  }

  // holdPercent values from OKX API are already in percent form (e.g. "51.39" = 51.39%).
  // Threshold 70/80 avoids false-positiving regulated stablecoins where a
  // single custodian legitimately holds half of circulating supply.
  if (input.holders.top1Percent >= 70) {
    s += 30;
    reasons.push(`top holder owns ${input.holders.top1Percent.toFixed(1)}%`);
  } else if (input.holders.top10Percent >= 80) {
    s += 15;
    reasons.push(`top 10 holders own ${input.holders.top10Percent.toFixed(1)}%`);
  }

  const clamped = Math.min(100, s);
  const verdict: Verdict = clamped >= 60 ? 'avoid' : clamped >= 25 ? 'caution' : 'safe';
  return { riskScore: clamped, verdict, reasons };
}
