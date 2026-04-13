import {
  Challenge402Schema,
  PaymentPayloadSchema,
  type Challenge402,
  type PaymentPayload,
} from '@x402/shared';

/**
 * Encode a 402 challenge payload as base64 JSON for the PAYMENT-REQUIRED header.
 * Per x402 v2: server-side 402 response header is base64(JSON(Challenge402)).
 */
export function encode402Payload(challenge: Challenge402): string {
  const validated = Challenge402Schema.parse(challenge);
  return Buffer.from(JSON.stringify(validated), 'utf8').toString('base64');
}

/**
 * Decode the PAYMENT-SIGNATURE header from a client and validate as PaymentPayload v2.
 * Throws on base64 decode error, non-JSON content, or schema mismatch.
 */
export function decodePaymentPayload(base64: string): PaymentPayload {
  const json = Buffer.from(base64, 'base64').toString('utf8');
  const parsed = JSON.parse(json);
  return PaymentPayloadSchema.parse(parsed);
}
