import type { FastifyPluginAsync } from 'fastify';
import type { OKXMCPClient } from '@x402/mcp-client';
import type { Store } from '@x402/orchestrator';
import type { MarketTrade } from '@x402/shared';

interface PluginOpts {
  mcpClient: OKXMCPClient;
  store: Store;
}

type Sentiment = 'accumulating' | 'distributing' | 'neutral';

interface WhaleWatchData {
  tokenAddress: string;
  lookback: { trades: number; holders: number };
  recentWhaleTrades: Array<{
    time: string;
    type: string;
    volume: string;
    priceUsd: string;
    userAddress: string;
    isTopHolder: boolean;
  }>;
  buySellBalance: {
    whaleBuyCount: number;
    whaleSellCount: number;
    whaleBuyVolume: number;
    whaleSellVolume: number;
  };
  signals: {
    sentiment: Sentiment;
    reasons: string[];
  };
}

// Threshold in USD for "whale" classification per single trade.
const WHALE_USD = 1000;

export const signalWhaleWatchRoute: FastifyPluginAsync<PluginOpts> = async (
  fastify,
  opts
) => {
  fastify.post(
    '/signal/whale-watch',
    {
      config: {
        // 5000 minimal units = 0.005 USDG
        x402: { amount: '5000', service: 'signal-whale-watch' },
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

      const [tradesRes, holdersRes] = await Promise.allSettled([
        opts.mcpClient.getMarketTrades({
          chainIndex: '196',
          tokenContractAddress: token,
          limit: '100',
        }),
        opts.mcpClient.getTokenHolders({
          chainIndex: '196',
          tokenContractAddress: token,
        }),
      ]);

      logCall(opts.store, 'dex-okx-market-trades', body, tradesRes, start);
      logCall(opts.store, 'dex-okx-market-token-holder', body, holdersRes, start);

      const trades = tradesRes.status === 'fulfilled' ? tradesRes.value : [];
      const holders = holdersRes.status === 'fulfilled' ? holdersRes.value : [];
      const topHolderSet = new Set(
        holders.slice(0, 50).map((h) => h.holderWalletAddress.toLowerCase())
      );

      const whales = trades.filter((t) => volumeUsd(t) >= WHALE_USD);
      const recent = whales.slice(0, 20).map((t) => ({
        time: t.time,
        type: t.type,
        volume: t.volume,
        priceUsd: t.price,
        userAddress: t.userAddress,
        isTopHolder: topHolderSet.has(t.userAddress.toLowerCase()),
      }));

      const balance = computeBalance(whales);
      const { sentiment, reasons } = classify(balance);

      const data: WhaleWatchData = {
        tokenAddress: token,
        lookback: { trades: trades.length, holders: holders.length },
        recentWhaleTrades: recent,
        buySellBalance: balance,
        signals: { sentiment, reasons },
      };

      return { service: 'signal-whale-watch', data, servedAt: Date.now() };
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

function volumeUsd(t: MarketTrade): number {
  const qty = Number(t.volume);
  const price = Number(t.price);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return 0;
  return qty * price;
}

function computeBalance(whales: MarketTrade[]) {
  let whaleBuyCount = 0;
  let whaleSellCount = 0;
  let whaleBuyVolume = 0;
  let whaleSellVolume = 0;
  for (const t of whales) {
    const usd = volumeUsd(t);
    if (t.type.toLowerCase() === 'buy') {
      whaleBuyCount += 1;
      whaleBuyVolume += usd;
    } else if (t.type.toLowerCase() === 'sell') {
      whaleSellCount += 1;
      whaleSellVolume += usd;
    }
  }
  return {
    whaleBuyCount,
    whaleSellCount,
    whaleBuyVolume: round(whaleBuyVolume),
    whaleSellVolume: round(whaleSellVolume),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function classify(balance: {
  whaleBuyVolume: number;
  whaleSellVolume: number;
}): { sentiment: Sentiment; reasons: string[] } {
  const reasons: string[] = [];
  const buys = balance.whaleBuyVolume;
  const sells = balance.whaleSellVolume;
  const total = buys + sells;
  if (total === 0) {
    return { sentiment: 'neutral', reasons: ['no whale activity in recent trades'] };
  }
  const buyShare = buys / total;
  if (buyShare >= 0.65) {
    reasons.push(`whales bought $${buys.toFixed(0)} vs sold $${sells.toFixed(0)}`);
    return { sentiment: 'accumulating', reasons };
  }
  if (buyShare <= 0.35) {
    reasons.push(`whales sold $${sells.toFixed(0)} vs bought $${buys.toFixed(0)}`);
    return { sentiment: 'distributing', reasons };
  }
  reasons.push(`whale flow roughly balanced ($${buys.toFixed(0)} buy vs $${sells.toFixed(0)} sell)`);
  return { sentiment: 'neutral', reasons };
}
