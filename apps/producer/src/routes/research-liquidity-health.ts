import type { FastifyPluginAsync } from 'fastify';
import type { OKXMCPClient } from '@x402/mcp-client';
import type { Store } from '@x402/orchestrator';
import type { Candlestick, Quote } from '@x402/shared';
import { USDG_CONTRACT } from '@x402/shared';

interface PluginOpts {
  mcpClient: OKXMCPClient;
  store: Store;
}

type Health = 'deep' | 'thin' | 'fragile';

interface LiquidityHealthData {
  tokenAddress: string;
  quoteToken: string;
  probes: Array<{
    amountUsdg: string;
    priceImpactPercent: string | null;
    toTokenAmount: string | null;
    router: string | null;
  }>;
  volatility: {
    bar: string;
    sampleSize: number;
    rangePercent: number | null;
    meanClose: number | null;
  };
  signals: {
    health: Health;
    impactAt100: number | null;
    impactAt1000: number | null;
    reasons: string[];
  };
}

// Three probe sizes in USDG minimal units (6 decimals):
// 10 USDG, 100 USDG, 1000 USDG. Mapping price impact across sizes yields
// a slippage curve the Consumer can interpret.
const PROBES = [
  { label: '10', amount: '10000000' },
  { label: '100', amount: '100000000' },
  { label: '1000', amount: '1000000000' },
] as const;

export const researchLiquidityHealthRoute: FastifyPluginAsync<PluginOpts> = async (
  fastify,
  opts
) => {
  fastify.post(
    '/research/liquidity-health',
    {
      config: {
        // 8000 minimal units = 0.008 USDG
        x402: { amount: '8000', service: 'research-liquidity-health' },
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

      const quoteTasks = PROBES.map((p) =>
        opts.mcpClient.getQuote({
          chainIndex: '196',
          fromTokenAddress: USDG_CONTRACT,
          toTokenAddress: token,
          amount: p.amount,
          swapMode: 'exactIn',
        })
      );
      const candlesTask = opts.mcpClient.getCandlesticks({
        chainIndex: '196',
        tokenContractAddress: token,
        bar: '1H',
        limit: '24',
      });

      const results = await Promise.allSettled([...quoteTasks, candlesTask]);
      const quoteResults = results.slice(0, PROBES.length) as PromiseSettledResult<Quote>[];
      const candlesRes = results[PROBES.length] as PromiseSettledResult<Candlestick[]>;

      quoteResults.forEach((res, i) => {
        logCall(
          opts.store,
          'dex-okx-dex-quote',
          { amount: PROBES[i]!.amount, token } as Record<string, unknown>,
          res,
          start
        );
      });
      logCall(
        opts.store,
        'dex-okx-market-candlesticks',
        { token, bar: '1H', limit: '24' } as Record<string, unknown>,
        candlesRes,
        start
      );

      const probes = quoteResults.map((res, i) => {
        const q = res.status === 'fulfilled' ? res.value : null;
        return {
          amountUsdg: PROBES[i]!.label,
          priceImpactPercent: q?.priceImpactPercent ?? null,
          toTokenAmount: q?.toTokenAmount ?? null,
          router: q?.router ?? null,
        };
      });

      const candles = candlesRes.status === 'fulfilled' ? candlesRes.value : null;
      const volatility = summarizeVolatility(candles);

      const impactAt100 = parseImpact(probes[1]?.priceImpactPercent ?? null);
      const impactAt1000 = parseImpact(probes[2]?.priceImpactPercent ?? null);

      const { health, reasons } = classify({ impactAt100, impactAt1000, volatility });

      const data: LiquidityHealthData = {
        tokenAddress: token,
        quoteToken: USDG_CONTRACT,
        probes,
        volatility,
        signals: { health, impactAt100, impactAt1000, reasons },
      };

      return { service: 'research-liquidity-health', data, servedAt: Date.now() };
    }
  );
};

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

function parseImpact(s: string | null): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function summarizeVolatility(candles: Candlestick[] | null) {
  if (!candles || candles.length === 0) {
    return { bar: '1H', sampleSize: 0, rangePercent: null, meanClose: null };
  }
  const closes = candles.map((c) => Number(c.close)).filter((n) => Number.isFinite(n));
  if (closes.length === 0) {
    return { bar: '1H', sampleSize: candles.length, rangePercent: null, meanClose: null };
  }
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
  const rangePercent = mean > 0 ? (max - min) / mean : null;
  return {
    bar: '1H',
    sampleSize: candles.length,
    rangePercent: rangePercent != null ? round(rangePercent) : null,
    meanClose: round(mean),
  };
}

function round(n: number, places = 6): number {
  const p = 10 ** places;
  return Math.round(n * p) / p;
}

function classify(input: {
  impactAt100: number | null;
  impactAt1000: number | null;
  volatility: { rangePercent: number | null };
}): { health: Health; reasons: string[] } {
  const reasons: string[] = [];
  let health: Health = 'deep';

  if (input.impactAt1000 != null && input.impactAt1000 >= 0.05) {
    health = 'fragile';
    reasons.push(
      `1000 USDG trade moves price ${(input.impactAt1000 * 100).toFixed(2)}%`
    );
  } else if (input.impactAt100 != null && input.impactAt100 >= 0.02) {
    health = 'thin';
    reasons.push(
      `100 USDG trade moves price ${(input.impactAt100 * 100).toFixed(2)}%`
    );
  }

  const range = input.volatility.rangePercent;
  if (range != null && range >= 0.2) {
    if (health === 'deep') health = 'thin';
    reasons.push(`24h range is ${(range * 100).toFixed(1)}% (high volatility)`);
  }

  if (reasons.length === 0) {
    reasons.push('low slippage across probe sizes, stable 24h range');
  }
  return { health, reasons };
}
