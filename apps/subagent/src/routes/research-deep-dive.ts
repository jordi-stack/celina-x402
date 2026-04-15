import type { FastifyPluginAsync } from 'fastify';
import type { ProducerX402Client, UpstreamCallResult } from '../client/producer-x402-client';

interface PluginOpts {
  producerClient: ProducerX402Client;
}

interface TokenReportShape {
  service: 'research-token-report';
  data: {
    tokenAddress: string;
    chainIndex: string;
    price: { price?: string; marketCap?: string; liquidity?: string; holders?: string } | null;
    security: Record<string, unknown> | null;
    dev: Record<string, unknown>;
    holders: { top10Percent: number; top1Percent: number; sampleSize: number };
    signals: { redFlags: string[]; riskScore: number; verdict: string; reasons: string[] };
  };
  servedAt: number;
}

interface LiquidityHealthShape {
  service: 'research-liquidity-health';
  data: {
    tokenAddress: string;
    quotes?: unknown;
    impact?: { at10?: number; at100?: number; at1000?: number };
    candlesticks?: unknown;
    signals?: { verdict?: string; riskScore?: number; reasons?: string[] };
  };
  servedAt: number;
}

interface DeepDiveResponse {
  service: 'research-deep-dive';
  data: {
    tokenAddress: string;
    chainIndex: '196';
    tokenReport: TokenReportShape['data'] | null;
    liquidityHealth: LiquidityHealthShape['data'] | null;
    correlation: {
      combinedRiskScore: number;
      liquidityVsMarketCapRatio: number | null;
      combinedVerdict: 'safe' | 'caution' | 'avoid';
      reasons: string[];
    };
    nestedCalls: Array<{
      service: 'research-token-report' | 'research-liquidity-health';
      priceUsdg: string;
      amountSpent: string;
      txHash: string | null;
      error: string | null;
      durationMs: number;
    }>;
    totalNestedSpentUsdg: string;
  };
  servedAt: number;
}

export const researchDeepDiveRoute: FastifyPluginAsync<PluginOpts> = async (
  fastify,
  opts
) => {
  fastify.post(
    '/research/deep-dive',
    {
      config: {
        // 30000 minimal units = 0.030 USDG. 2x the base research-token-report
        // price since we're composing two upstream paid calls and adding a
        // correlation layer on top.
        x402: { amount: '30000', service: 'research-deep-dive' },
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
    async (request): Promise<DeepDiveResponse> => {
      const body = request.body as { tokenAddress: string };
      const token = body.tokenAddress.toLowerCase();

      // Call both upstream services in parallel so the sub-agent signs
      // two separate x402 payments. The wallet switch inside
      // ProducerX402Client.callPaidService runs twice (once per call) but
      // that's fine — both switch to the same Sub-agent account.
      const [tokenReportRes, liquidityHealthRes] = await Promise.all([
        opts.producerClient.callPaidService<TokenReportShape>('research-token-report', {
          tokenAddress: token,
        }),
        opts.producerClient.callPaidService<LiquidityHealthShape>(
          'research-liquidity-health',
          { tokenAddress: token }
        ),
      ]);

      const tokenReport = unwrapServiceData(tokenReportRes);
      const liquidityHealth = unwrapServiceData(liquidityHealthRes);

      const correlation = correlate(tokenReport, liquidityHealth);

      const totalNestedMinimal =
        BigInt(tokenReportRes.amountSpent || '0') +
        BigInt(liquidityHealthRes.amountSpent || '0');
      const totalNestedUsdg = (Number(totalNestedMinimal) / 1e6).toFixed(6);

      return {
        service: 'research-deep-dive',
        data: {
          tokenAddress: token,
          chainIndex: '196',
          tokenReport,
          liquidityHealth,
          correlation,
          nestedCalls: [
            {
              service: 'research-token-report',
              priceUsdg: '0.015',
              amountSpent: tokenReportRes.amountSpent,
              txHash: tokenReportRes.txHash,
              error: tokenReportRes.error,
              durationMs: tokenReportRes.durationMs,
            },
            {
              service: 'research-liquidity-health',
              priceUsdg: '0.008',
              amountSpent: liquidityHealthRes.amountSpent,
              txHash: liquidityHealthRes.txHash,
              error: liquidityHealthRes.error,
              durationMs: liquidityHealthRes.durationMs,
            },
          ],
          totalNestedSpentUsdg: totalNestedUsdg,
        },
        servedAt: Date.now(),
      };
    }
  );
};

function unwrapServiceData<T extends { data: unknown }>(
  res: UpstreamCallResult<T>
): T['data'] | null {
  if (res.status !== 200 || !res.data) return null;
  const outer = res.data as T;
  return outer.data;
}

function correlate(
  tokenReport: TokenReportShape['data'] | null,
  liquidityHealth: LiquidityHealthShape['data'] | null
): DeepDiveResponse['data']['correlation'] {
  const reasons: string[] = [];
  let combinedRisk = 0;

  if (tokenReport) {
    combinedRisk += tokenReport.signals.riskScore;
    reasons.push(...tokenReport.signals.reasons);
  } else {
    combinedRisk += 50;
    reasons.push('token-report upstream call failed — treating as high risk');
  }

  if (liquidityHealth) {
    const liqRisk = Number(liquidityHealth.signals?.riskScore ?? 0);
    combinedRisk += Number.isFinite(liqRisk) ? liqRisk : 0;
    reasons.push(...(liquidityHealth.signals?.reasons ?? []));
  } else {
    combinedRisk += 30;
    reasons.push('liquidity-health upstream call failed — cannot verify depth');
  }

  const marketCap = Number(tokenReport?.price?.marketCap ?? 0);
  const liquidity = Number(tokenReport?.price?.liquidity ?? 0);
  let liqRatio: number | null = null;
  if (marketCap > 0 && Number.isFinite(liquidity)) {
    liqRatio = liquidity / marketCap;
    if (liqRatio < 0.01) {
      combinedRisk += 20;
      reasons.push(
        `liquidity is only ${(liqRatio * 100).toFixed(2)}% of market cap (below 1% threshold)`
      );
    }
  }

  const clamped = Math.min(100, combinedRisk);
  const verdict: 'safe' | 'caution' | 'avoid' =
    clamped >= 60 ? 'avoid' : clamped >= 25 ? 'caution' : 'safe';

  return {
    combinedRiskScore: clamped,
    liquidityVsMarketCapRatio: liqRatio,
    combinedVerdict: verdict,
    reasons,
  };
}
