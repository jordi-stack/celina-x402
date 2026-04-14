import { z } from 'zod';

// Zod schemas for the onchainos security CLI suite.
// Shapes captured live 2026-04-15 via scripts/src/spikes/security-spike.ts
// against USDG on X Layer (chain index 196). Envelope pattern differs
// across commands: token-scan + approvals return `data` as array;
// tx-scan + dapp-scan return `data` as single object. Reflect that below.

// === security token-scan ===
// data: [TokenRiskReport] — one entry per token queried
export const TokenRiskReportSchema = z.object({
  tokenAddress: z.string(),
  chainId: z.string(),
  buyTaxes: z.string(),
  sellTaxes: z.string(),
  // 23 boolean flags, some obvious, some poorly named.
  isAirdropScam: z.boolean(),
  isChainSupported: z.boolean(),
  isCounterfeit: z.boolean(),
  isDumping: z.boolean(),
  isFakeLiquidity: z.boolean(),
  isFundLinkage: z.boolean(),
  isHasAssetEditAuth: z.boolean(),
  isHasBlockingHis: z.boolean(),
  isHasFrozenAuth: z.boolean(),
  isHoneypot: z.boolean(),
  isLiquidityRemoval: z.boolean(),
  isLowLiquidity: z.boolean(),
  isMintable: z.boolean(),
  isNotRenounced: z.boolean(),
  isOverIssued: z.boolean(),
  isPump: z.boolean(),
  isRiskToken: z.boolean(),
  isRubbishAirdrop: z.boolean(),
  isVeryHighLpHolderProp: z.boolean(),
  isVeryLowLpBurn: z.boolean(),
  isWash: z.boolean(),
  isWash2: z.boolean(),
});
export type TokenRiskReport = z.infer<typeof TokenRiskReportSchema>;

export const TokenScanEnvelopeSchema = z.object({
  ok: z.boolean(),
  data: z.array(TokenRiskReportSchema),
});
export type TokenScanEnvelope = z.infer<typeof TokenScanEnvelopeSchema>;

// === security tx-scan ===
// data: single object with simulator + riskItemDetail[] + warnings
const TxSimulatorSchema = z.object({
  gasLimit: z.union([z.string(), z.number(), z.null()]),
  gasUsed: z.union([z.string(), z.number(), z.null()]),
  revertReason: z.string().nullable(),
});

export const TxScanReportSchema = z.object({
  action: z.string(),
  riskItemDetail: z.array(z.unknown()),
  simulator: TxSimulatorSchema,
  warnings: z.array(z.unknown()).nullable(),
});
export type TxScanReport = z.infer<typeof TxScanReportSchema>;

export const TxScanEnvelopeSchema = z.object({
  ok: z.boolean(),
  data: TxScanReportSchema,
});
export type TxScanEnvelope = z.infer<typeof TxScanEnvelopeSchema>;

// === security approvals ===
// data: [{ cursor, dataList, total }] — paginated wrapper
// dataList shape differs per entry; for fresh wallets it's empty. Use passthrough
// until we capture a populated response to tighten the per-approval shape.
const ApprovalEntrySchema = z.object({}).passthrough();

export const ApprovalsPageSchema = z.object({
  cursor: z.union([z.string(), z.number()]),
  total: z.number(),
  dataList: z.array(ApprovalEntrySchema),
});
export type ApprovalsPage = z.infer<typeof ApprovalsPageSchema>;

export const ApprovalsEnvelopeSchema = z.object({
  ok: z.boolean(),
  data: z.array(ApprovalsPageSchema),
});
export type ApprovalsEnvelope = z.infer<typeof ApprovalsEnvelopeSchema>;

// === security dapp-scan ===
// data: single object { isMalicious: boolean }
export const DappScanReportSchema = z.object({
  isMalicious: z.boolean(),
});
export type DappScanReport = z.infer<typeof DappScanReportSchema>;

export const DappScanEnvelopeSchema = z.object({
  ok: z.boolean(),
  data: DappScanReportSchema,
});
export type DappScanEnvelope = z.infer<typeof DappScanEnvelopeSchema>;
