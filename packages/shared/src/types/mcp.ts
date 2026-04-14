import { z } from 'zod';

// Token address regex for EVM chains (lowercase enforced by OKX API)
const evmAddress = () => z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export const QuoteParamsSchema = z.object({
  chainIndex: z.literal('196'),
  fromTokenAddress: evmAddress(),
  toTokenAddress: evmAddress(),
  amount: z.string().regex(/^[0-9]+$/),
  // swapMode is required by MCP tool (confirmed via Day 1 spike)
  swapMode: z.enum(['exactIn', 'exactOut']).default('exactIn'),
  // Optional DEX params (confirmed from tools/list schema)
  dexIds: z.string().optional(),
  directRoute: z.boolean().optional(),
  priceImpactProtectionPercent: z.string().optional(),
  feePercent: z.string().optional(),
});
export type QuoteParams = z.infer<typeof QuoteParamsSchema>;

// Token sub-object shape confirmed via Day 1 MCP spike
const QuoteTokenSchema = z.object({
  tokenContractAddress: evmAddress(),
  tokenSymbol: z.string(),
  decimal: z.string(),
  tokenUnitPrice: z.string(),
  isHoneyPot: z.boolean(),
  taxRate: z.string(),
});

// dexRouterList item shape confirmed via Day 1 MCP spike
const DexRouterItemSchema = z.object({
  dexProtocol: z.object({
    dexName: z.string(),
    percent: z.string(),
  }),
  fromToken: QuoteTokenSchema,
  toToken: QuoteTokenSchema,
  fromTokenIndex: z.string(),
  toTokenIndex: z.string(),
});

// Quote object shape pinned from Day 1 MCP spike.
// MCP wraps this inside result.content[0].text -> JSON -> data[0].
export const QuoteSchema = z.object({
  chainIndex: z.string(),
  contextSlot: z.number(),
  fromToken: QuoteTokenSchema,
  toToken: QuoteTokenSchema,
  fromTokenAmount: z.string(),
  toTokenAmount: z.string(),
  // Note: actual field is priceImpactPercent, not priceImpactPercentage
  priceImpactPercent: z.string(),
  estimateGasFee: z.string(),
  tradeFee: z.string(),
  router: z.string(),
  swapMode: z.string(),
  dexRouterList: z.array(DexRouterItemSchema),
});
export type Quote = z.infer<typeof QuoteSchema>;

// TokenPriceInfo params: tool takes { items: [...] } batch wrapper (confirmed via Day 1 spike)
export const TokenPriceInfoParamsSchema = z.object({
  items: z
    .array(
      z.object({
        chainIndex: z.literal('196'),
        tokenContractAddress: evmAddress(),
      })
    )
    .min(1)
    .max(100),
});
export type TokenPriceInfoParams = z.infer<typeof TokenPriceInfoParamsSchema>;

// TokenPriceInfo object shape pinned from Day 1 MCP spike.
// All numeric values arrive as strings. Case is uppercase H (24H, 1H, etc.).
// Pre-spike assumption of `holderCount` was wrong; actual field is `holders`.
// Pre-spike `symbol` field is not present in the response.
export const TokenPriceInfoSchema = z.object({
  chainIndex: z.string(),
  tokenContractAddress: z.string(),
  price: z.string(),
  priceChange24H: z.string(),
  priceChange1H: z.string(),
  priceChange4H: z.string(),
  priceChange5M: z.string(),
  volume24H: z.string(),
  volume1H: z.string(),
  volume4H: z.string(),
  volume5M: z.string(),
  marketCap: z.string(),
  holders: z.string(),
  circSupply: z.string(),
  liquidity: z.string(),
  maxPrice: z.string(),
  minPrice: z.string(),
  tradeNum: z.string(),
  txs24H: z.string(),
  txs1H: z.string(),
  txs4H: z.string(),
  txs5M: z.string(),
  // Unix timestamp in ms, returned as string
  time: z.string(),
});
export type TokenPriceInfo = z.infer<typeof TokenPriceInfoSchema>;

// dex-okx-balance-total-token-balances params: `chains` must be a single
// string, NOT an array (array gives error 50014 "chains is invalid").
// Confirmed via Move 1 balance spike.
export const TotalTokenBalancesParamsSchema = z.object({
  chains: z.string(),
  address: evmAddress(),
});
export type TotalTokenBalancesParams = z.infer<typeof TotalTokenBalancesParamsSchema>;

// Individual token row returned by dex-okx-balance-total-token-balances.
// Shape captured live via Move 1 balance spike against X Layer (chain 196).
// `balance` is already in decimal form; `rawBalance` is the uint minimal-unit string.
export const TokenAssetSchema = z.object({
  chainIndex: z.string(),
  symbol: z.string(),
  balance: z.string(),
  tokenPrice: z.string(),
  isRiskToken: z.boolean(),
  rawBalance: z.string(),
  address: z.string(),
  tokenContractAddress: z.string(),
});
export type TokenAsset = z.infer<typeof TokenAssetSchema>;

// data[0] envelope for total-token-balances: one object containing a
// tokenAssets array across the queried chain(s).
export const TotalTokenBalancesSchema = z.object({
  tokenAssets: z.array(TokenAssetSchema),
});
export type TotalTokenBalances = z.infer<typeof TotalTokenBalancesSchema>;

// === dex-okx-market-candlesticks ===
// Captured live 2026-04-15. Raw shape: data is array of 8-string tuples:
// [timestamp_ms, open, high, low, close, volume_base, volume_usd, confirmed_0_or_1]
export const CandlesticksParamsSchema = z.object({
  chainIndex: z.literal('196'),
  tokenContractAddress: evmAddress(),
  bar: z
    .enum([
      '1s', '1m', '3m', '5m', '15m', '30m',
      '1H', '2H', '4H', '6H', '12H', '1D', '1W', '1M', '3M',
    ])
    .default('1m'),
  limit: z.string().regex(/^[0-9]+$/).default('100'),
  after: z.string().optional(),
  before: z.string().optional(),
});
export type CandlesticksParams = z.infer<typeof CandlesticksParamsSchema>;

export const CandlestickSchema = z
  .tuple([
    z.string(), z.string(), z.string(), z.string(),
    z.string(), z.string(), z.string(), z.string(),
  ])
  .transform(([ts, open, high, low, close, volume, volumeUsd, confirm]) => ({
    ts,
    open,
    high,
    low,
    close,
    volume,
    volumeUsd,
    confirmed: confirm === '1',
  }));
export type Candlestick = z.infer<typeof CandlestickSchema>;

// === dex-okx-market-token-holder ===
// Captured live 2026-04-15. data is array of 100 holder objects for USDG.
// All numeric values are strings, PnL fields empty for stablecoins.
export const TokenHolderParamsSchema = z.object({
  chainIndex: z.literal('196'),
  tokenContractAddress: evmAddress(),
  // '' | '1'..'9' — see tagFilter description in tools/list
  tagFilter: z.string().optional(),
});
export type TokenHolderParams = z.infer<typeof TokenHolderParamsSchema>;

export const TokenHolderSchema = z.object({
  cursor: z.string(),
  holderWalletAddress: z.string(),
  holdAmount: z.string(),
  holdPercent: z.string(),
  nativeTokenBalance: z.string(),
  fundingSource: z.string(),
  avgBuyPrice: z.string(),
  avgSellPrice: z.string(),
  boughtAmount: z.string(),
  totalSellAmount: z.string(),
  realizedPnlUsd: z.string(),
  unrealizedPnlUsd: z.string(),
  totalPnlUsd: z.string(),
});
export type TokenHolder = z.infer<typeof TokenHolderSchema>;

// === dex-okx-market-trades ===
// Captured live 2026-04-15. data is array of trade objects.
export const MarketTradesParamsSchema = z.object({
  chainIndex: z.literal('196'),
  tokenContractAddress: evmAddress(),
  limit: z.string().regex(/^[0-9]+$/).default('20'),
  tagFilter: z.string().optional(),
  walletAddressFilter: z.string().optional(),
});
export type MarketTradesParams = z.infer<typeof MarketTradesParamsSchema>;

const ChangedTokenInfoSchema = z.object({
  amount: z.string(),
  tokenAddress: z.string(),
  tokenSymbol: z.string(),
});

export const MarketTradeSchema = z
  .object({
    id: z.string(),
    chainIndex: z.string(),
    tokenContractAddress: z.string(),
    time: z.string(),
    price: z.string(),
    dexName: z.string(),
    poolLogoUrl: z.string().optional(),
    txHashUrl: z.string().optional(),
    isFiltered: z.string(),
    type: z.string(),
    userAddress: z.string(),
    volume: z.string(),
    changedTokenInfo: z.array(ChangedTokenInfoSchema),
  })
  .passthrough();
export type MarketTrade = z.infer<typeof MarketTradeSchema>;

// === dex-okx-balance-total-value ===
// Captured live 2026-04-15. data is array with a single object: [{ totalValue }]
export const BalanceTotalValueParamsSchema = z.object({
  // Comma-separated chain indices, single-chain = '196'. MUST be string, not array.
  chains: z.string(),
  address: evmAddress(),
  // 0: all (default), 1: tokens only, 2: DeFi only
  assetType: z.enum(['0', '1', '2']).optional(),
  excludeRiskToken: z.boolean().optional(),
});
export type BalanceTotalValueParams = z.infer<typeof BalanceTotalValueParamsSchema>;

export const BalanceTotalValueSchema = z.object({
  totalValue: z.string(),
});
export type BalanceTotalValue = z.infer<typeof BalanceTotalValueSchema>;

export const McpJsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.literal('tools/call'),
  params: z.object({
    name: z.string(),
    arguments: z.record(z.string(), z.unknown()),
  }),
  id: z.union([z.string(), z.number()]),
});
export type McpJsonRpcRequest = z.infer<typeof McpJsonRpcRequestSchema>;

export const McpJsonRpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
});
export type McpJsonRpcResponse = z.infer<typeof McpJsonRpcResponseSchema>;

// MCP result envelope: result.content[0].text is JSON-encoded string
// containing { code: string, data: T[], msg: string }
export const McpToolEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    code: z.string(),
    data: z.array(dataSchema),
    msg: z.string(),
  });
