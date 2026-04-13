import { z } from 'zod';
import { PaymentPayloadSchema, AcceptSchema } from './x402';

export const VerifyRequestSchema = z.object({
  x402Version: z.literal(2),
  paymentPayload: PaymentPayloadSchema,
  paymentRequirements: AcceptSchema,
});
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

export const VerifyResponseSchema = z.object({
  isValid: z.boolean(),
  invalidReason: z.string().nullable(),
  invalidMessage: z.string().nullable(),
  payer: z.string(),
});
export type VerifyResponse = z.infer<typeof VerifyResponseSchema>;

export const SettleRequestSchema = VerifyRequestSchema.extend({
  syncSettle: z.boolean(),
});
export type SettleRequest = z.infer<typeof SettleRequestSchema>;

export const SettleResponseSchema = z.object({
  success: z.boolean(),
  errorReason: z.string().nullable(),
  errorMessage: z.string().nullable(),
  payer: z.string(),
  transaction: z.string(),
  network: z.literal('eip155:196'),
  status: z.enum(['pending', 'success', 'timeout', '']),
});
export type SettleResponse = z.infer<typeof SettleResponseSchema>;

// NOTE: Loose pre-spike shape. Day 1 facilitator spike will capture real response
// and pin this schema. Use .passthrough() to avoid spike failures on unexpected fields.
export const SupportedResponseSchema = z
  .object({
    kinds: z
      .array(
        z
          .object({
            x402Version: z.literal(2),
            scheme: z.enum(['exact', 'aggr_deferred']),
            network: z.literal('eip155:196'),
          })
          .passthrough()
      )
      .optional(),
    extensions: z.array(z.string()).optional(),
    signers: z.unknown().optional(),
  })
  .passthrough();
export type SupportedResponse = z.infer<typeof SupportedResponseSchema>;

// Day 1 facilitator spike observed live shape: `code` arrives as a JSON number,
// not a string as the earlier doc examples suggested. Coerce to string so
// downstream comparisons like `envelope.code === '0'` remain stable regardless
// of which form a given OKX endpoint emits.
export const OkxApiEnvelopeSchema = z.object({
  code: z.coerce.string(),
  msg: z.string(),
  data: z.unknown(),
});
export type OkxApiEnvelope = z.infer<typeof OkxApiEnvelopeSchema>;
