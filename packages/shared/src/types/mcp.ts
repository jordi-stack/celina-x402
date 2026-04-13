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
