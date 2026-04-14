import type { FastifyPluginAsync } from 'fastify';
import type { OKXMCPClient } from '@x402/mcp-client';
import type { SecurityClient, TrenchesClient } from '@x402/onchain-clients';
import type { Store } from '@x402/orchestrator';
import type { Candlestick, TokenPriceInfo, TokenRiskReport } from '@x402/shared';

interface PluginOpts {
  mcpClient: OKXMCPClient;
  securityClient: SecurityClient;
  trenchesClient: TrenchesClient;
  store: Store;
}

type Verdict = 'promising' | 'mixed' | 'skip';

interface NewTokenScoutData {
  tokenAddress: string;
  price: TokenPriceInfo | null;
  momentum: {
    priceChange5M: string | null;
    priceChange1H: string | null;
    priceChange4H: string | null;
    priceChange24H: string | null;
    txs1H: string | null;
    holders: string | null;
  };
  microTrend: {
    bar: string;
    sampleSize: number;
    slopePercent: number | null;
  };
  dev: {
    rugPullCount: number;
    bundleDetected: boolean;
    sniperCount: number;
  };
  security: {
    blocking: string[];
  };
  signals: {
    opportunityScore: number;
    verdict: Verdict;
    reasons: string[];
  };
}

// Flags that disqualify a token from "promising" regardless of other signals.
const BLOCKING_FLAGS = [
  'isHoneypot',
  'isRiskToken',
  'isAirdropScam',
  'isCounterfeit',
  'isLiquidityRemoval',
  'isHasFrozenAuth',
] as const satisfies readonly (keyof TokenRiskReport)[];

export const signalNewTokenScoutRoute: FastifyPluginAsync<PluginOpts> = async (
  fastify,
  opts
) => {
  fastify.post(
    '/signal/new-token-scout',
    {
      config: {
        // 3000 minimal units = 0.003 USDG — cheapest tier
        x402: { amount: '3000', service: 'signal-new-token-scout' },
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

      const [priceRes, candlesRes, scanRes, devRes, bundleRes] =
        await Promise.allSettled([
          opts.mcpClient.getTokenPriceInfo({
            items: [{ chainIndex: '196', tokenContractAddress: token }],
          }),
          opts.mcpClient.getCandlesticks({
            chainIndex: '196',
            tokenContractAddress: token,
            bar: '1m',
            limit: '60',
          }),
          opts.securityClient.tokenScan({ chainId: '196', tokenAddress: token }),
          opts.trenchesClient.tokenDevInfo(token),
          opts.trenchesClient.bundleInfo(token),
        ]);

      logCall(opts.store, 'dex-okx-market-token-price-info', body, priceRes, start);
      logCall(opts.store, 'dex-okx-market-candlesticks', body, candlesRes, start);
      logCall(opts.store, 'security-token-scan', body, scanRes, start);
      logCall(opts.store, 'memepump-token-dev-info', body, devRes, start);
      logCall(opts.store, 'memepump-token-bundle-info', body, bundleRes, start);

      const price = unwrap(priceRes);
      const candles = unwrap(candlesRes);
      const security = unwrap(scanRes);
      const devInfo = unwrap(devRes);
      const bundleInfo = unwrap(bundleRes);

      const blocking = security
        ? BLOCKING_FLAGS.filter((f) => security[f])
        : [];

      const dev = {
        rugPullCount: devInfo?.devHoldingInfo?.rugPullCount ?? 0,
        bundleDetected: bundleInfo?.bundleDetected ?? false,
        sniperCount: bundleInfo?.sniperCount ?? 0,
      };

      const microTrend = computeTrend(candles);
      const { opportunityScore, verdict, reasons } = scoreOpportunity({
        price,
        microTrend,
        dev,
        blocking,
      });

      const data: NewTokenScoutData = {
        tokenAddress: token,
        price,
        momentum: {
          priceChange5M: price?.priceChange5M ?? null,
          priceChange1H: price?.priceChange1H ?? null,
          priceChange4H: price?.priceChange4H ?? null,
          priceChange24H: price?.priceChange24H ?? null,
          txs1H: price?.txs1H ?? null,
          holders: price?.holders ?? null,
        },
        microTrend,
        dev,
        security: { blocking: blocking.map((s) => s) },
        signals: { opportunityScore, verdict, reasons },
      };

      return { service: 'signal-new-token-scout', data, servedAt: Date.now() };
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

function computeTrend(candles: Candlestick[] | null) {
  if (!candles || candles.length < 2) {
    return { bar: '1m', sampleSize: candles?.length ?? 0, slopePercent: null };
  }
  // Candles arrive newest-first; reverse to iterate chronologically.
  const ordered = [...candles].reverse();
  const first = Number(ordered[0]!.close);
  const last = Number(ordered[ordered.length - 1]!.close);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) {
    return { bar: '1m', sampleSize: ordered.length, slopePercent: null };
  }
  const slope = (last - first) / first;
  return { bar: '1m', sampleSize: ordered.length, slopePercent: round(slope) };
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function scoreOpportunity(input: {
  price: TokenPriceInfo | null;
  microTrend: { slopePercent: number | null };
  dev: { rugPullCount: number; bundleDetected: boolean; sniperCount: number };
  blocking: readonly string[];
}): { opportunityScore: number; verdict: Verdict; reasons: string[] } {
  const reasons: string[] = [];

  if (input.blocking.length > 0) {
    reasons.push(`blocked: ${input.blocking.join(', ')}`);
    return { opportunityScore: 0, verdict: 'skip', reasons };
  }

  let s = 0;

  const change24h = Number(input.price?.priceChange24H ?? '');
  if (Number.isFinite(change24h)) {
    if (change24h >= 0.2) {
      s += 20;
      reasons.push(`+${(change24h * 100).toFixed(1)}% 24h`);
    } else if (change24h <= -0.3) {
      s -= 15;
      reasons.push(`${(change24h * 100).toFixed(1)}% 24h`);
    }
  }

  const change1h = Number(input.price?.priceChange1H ?? '');
  if (Number.isFinite(change1h) && change1h >= 0.05) {
    s += 15;
    reasons.push(`+${(change1h * 100).toFixed(1)}% 1h`);
  }

  const slope = input.microTrend.slopePercent;
  if (slope != null && slope >= 0.02) {
    s += 15;
    reasons.push(`60m uptrend ${(slope * 100).toFixed(1)}%`);
  } else if (slope != null && slope <= -0.02) {
    s -= 10;
    reasons.push(`60m downtrend ${(slope * 100).toFixed(1)}%`);
  }

  const txs1h = Number(input.price?.txs1H ?? '');
  if (Number.isFinite(txs1h) && txs1h >= 50) {
    s += 10;
    reasons.push(`${txs1h} txs in last hour`);
  }

  if (input.dev.rugPullCount >= 1) {
    s -= 25;
    reasons.push(`dev has ${input.dev.rugPullCount} prior rugpull(s)`);
  }
  if (input.dev.bundleDetected) {
    s -= 10;
    reasons.push('bundle launch detected');
  }
  if (input.dev.sniperCount > 10) {
    s -= 10;
    reasons.push(`${input.dev.sniperCount} snipers at launch`);
  }

  const clamped = Math.max(0, Math.min(100, s));
  const verdict: Verdict =
    clamped >= 40 ? 'promising' : clamped >= 15 ? 'mixed' : 'skip';
  if (reasons.length === 0) {
    reasons.push('insufficient momentum signals');
  }
  return { opportunityScore: clamped, verdict, reasons };
}
