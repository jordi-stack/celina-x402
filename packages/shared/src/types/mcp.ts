import { z } from 'zod';

export const QuoteParamsSchema = z.object({
  chainIndex: z.literal('196'),
  fromTokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  toTokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().regex(/^[0-9]+$/),
  slippage: z.string().optional(),
});
export type QuoteParams = z.infer<typeof QuoteParamsSchema>;

// NOTE: Pre-spike shape based on spec Section 2 Component 5.
// Day 1 MCP spike (Task 7) will capture real response and tighten via Step 7.6.
// All fields optional + .passthrough() so spike parsing succeeds regardless.
export const QuoteSchema = z
  .object({
    chainIndex: z.string().optional(),
    fromToken: z
      .object({
        address: z.string(),
        symbol: z.string(),
        decimal: z.string(),
      })
      .passthrough()
      .optional(),
    toToken: z
      .object({
        address: z.string(),
        symbol: z.string(),
        decimal: z.string(),
      })
      .passthrough()
      .optional(),
    fromTokenAmount: z.string().optional(),
    toTokenAmount: z.string().optional(),
    priceImpactPercentage: z.string().optional(),
    estimateGasFee: z.string().optional(),
    dexRouterList: z
      .array(
        z
          .object({
            dexName: z.string().optional(),
            ratio: z.string().optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough();
export type Quote = z.infer<typeof QuoteSchema>;

export const TokenPriceInfoParamsSchema = z.object({
  chainIndex: z.literal('196'),
  tokenContractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});
export type TokenPriceInfoParams = z.infer<typeof TokenPriceInfoParamsSchema>;

// NOTE: Pre-spike shape based on spec Section 2 Component 5.
// Fields will be tightened after Day 1 MCP spike (Task 7).
export const TokenPriceInfoSchema = z
  .object({
    chainIndex: z.string().optional(),
    tokenAddress: z.string().optional(),
    tokenContractAddress: z.string().optional(),
    symbol: z.string().optional(),
    price: z.string().optional(),
    priceChange24h: z.string().optional(),
    volume24h: z.string().optional(),
    marketCap: z.string().optional(),
    holderCount: z.string().optional(),
  })
  .passthrough();
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
