import { describe, it, expect } from 'vitest';
import { encode402Payload, decodePaymentPayload } from '@x402/x402-server';
import type { Challenge402, PaymentPayload } from '@x402/shared';

describe('encode402Payload / decodePaymentPayload', () => {
  it('round-trips a Challenge402 via base64 encoding', () => {
    const challenge: Challenge402 = {
      x402Version: 2,
      error: 'PAYMENT-SIGNATURE header is required',
      resource: {
        url: 'http://localhost/v1/market-snapshot',
        description: 'market-snapshot',
        mimeType: 'application/json',
      },
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:196',
          amount: '10000',
          asset: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
          payTo: '0xdfe57c7775f09599d12d11370a0afcb27f6aadbc',
          maxTimeoutSeconds: 60,
          extra: { name: 'USDG', version: '2' },
        },
      ],
    };
    const encoded = encode402Payload(challenge);
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    expect(parsed.x402Version).toBe(2);
    expect(parsed.accepts[0].amount).toBe('10000');
  });

  it('decodes a base64-encoded PaymentPayload header', () => {
    const payload: PaymentPayload = {
      x402Version: 2,
      resource: {
        url: 'http://localhost/v1/market-snapshot',
        description: 'market-snapshot',
        mimeType: 'application/json',
      },
      accepted: {
        scheme: 'exact',
        network: 'eip155:196',
        amount: '10000',
        asset: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
        payTo: '0xdfe57c7775f09599d12d11370a0afcb27f6aadbc',
        maxTimeoutSeconds: 60,
        extra: { name: 'USDG', version: '2' },
      },
      payload: {
        signature: '0xSIG',
        authorization: {
          from: '0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25',
          to: '0xdfe57c7775f09599d12d11370a0afcb27f6aadbc',
          value: '10000',
          validAfter: '0',
          validBefore: '1000',
          nonce: '0xdeadbeef',
        },
      },
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
    const decoded = decodePaymentPayload(encoded);
    expect(decoded.x402Version).toBe(2);
    expect(decoded.payload.authorization.nonce).toBe('0xdeadbeef');
  });

  it('throws on invalid base64 / non-JSON content', () => {
    // Note: Buffer.from(x, 'base64') is permissive and does not throw on invalid input.
    // So the throw comes from JSON.parse or Zod validation, not from base64 decode.
    expect(() => decodePaymentPayload('!!!not-base64!!!')).toThrow();
  });

  it('throws on valid base64 but invalid PaymentPayload shape', () => {
    const bogus = Buffer.from('{"bogus":true}').toString('base64');
    expect(() => decodePaymentPayload(bogus)).toThrow();
  });
});
