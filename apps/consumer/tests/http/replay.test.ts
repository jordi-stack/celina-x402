import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { replayWithPayment, parseChallenge402 } from '../../src/http/replay';
import type { PaymentProof } from '@x402/onchain-clients';

describe('parseChallenge402', () => {
  it('decodes PAYMENT-REQUIRED header from a 402 response', () => {
    const challenge = {
      x402Version: 2,
      error: 'PAYMENT-SIGNATURE header is required',
      resource: { url: '/v1/x', description: 'x', mimeType: 'application/json' },
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
    const headerValue = Buffer.from(JSON.stringify(challenge)).toString('base64');
    const parsed = parseChallenge402(headerValue);
    expect(parsed.accepts[0]?.amount).toBe('10000');
  });
});

describe('replayWithPayment', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('replays request with PAYMENT-SIGNATURE header and returns body on 200', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: 'resource' }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const proof: PaymentProof = {
      signature: '0xSIG',
      authorization: {
        from: '0x5fa0f8f77b47ea1ca48d8c9ed8560a130ad64e25',
        to: '0xdfe57c7775f09599d12d11370a0afcb27f6aadbc',
        value: '10000',
        validAfter: '0',
        validBefore: '1000',
        nonce: '0xdeadbeef',
      },
    };
    const accept = {
      scheme: 'exact' as const,
      network: 'eip155:196' as const,
      amount: '10000',
      asset: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
      payTo: '0xdfe57c7775f09599d12d11370a0afcb27f6aadbc',
      maxTimeoutSeconds: 60,
      extra: { name: 'USDG', version: '2' },
    };
    const body = { tokenContractAddress: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8' };

    const result = await replayWithPayment({
      url: 'http://localhost:3001/v1/market-snapshot',
      body,
      accept,
      proof,
    });

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ data: 'resource' });

    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['PAYMENT-SIGNATURE']).toBeDefined();
  });
});
