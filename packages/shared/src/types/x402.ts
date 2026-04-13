import { z } from 'zod';

export const AcceptSchema = z.object({
  scheme: z.enum(['exact', 'aggr_deferred']),
  network: z.literal('eip155:196'),
  amount: z.string().regex(/^[0-9]+$/),
  asset: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  payTo: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  maxTimeoutSeconds: z.number().positive(),
  extra: z.object({
    name: z.string(),
    version: z.string(),
  }),
});
export type Accept = z.infer<typeof AcceptSchema>;

export const AuthorizationSchema = z.object({
  from: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  value: z.string().regex(/^[0-9]+$/),
  validAfter: z.string(),
  validBefore: z.string(),
  nonce: z.string().regex(/^0x[a-fA-F0-9]+$/),
});
export type Authorization = z.infer<typeof AuthorizationSchema>;

export const PaymentPayloadSchema = z.object({
  x402Version: z.literal(2),
  resource: z.object({
    url: z.string().url(),
    description: z.string(),
    mimeType: z.string(),
  }),
  accepted: AcceptSchema,
  payload: z.object({
    signature: z.string(),
    authorization: AuthorizationSchema,
    sessionCert: z.string().optional(),
  }),
});
export type PaymentPayload = z.infer<typeof PaymentPayloadSchema>;

export const Challenge402Schema = z.object({
  x402Version: z.literal(2),
  error: z.string().optional(),
  resource: z.object({
    url: z.string(),
    description: z.string(),
    mimeType: z.string(),
  }),
  accepts: z.array(AcceptSchema),
});
export type Challenge402 = z.infer<typeof Challenge402Schema>;
