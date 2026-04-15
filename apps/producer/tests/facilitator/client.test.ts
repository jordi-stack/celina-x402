import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FacilitatorClient } from '@x402/x402-server';

describe('FacilitatorClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('verify() posts to /api/v6/pay/x402/verify with signed HMAC headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: '0',
        msg: 'success',
        data: {
          isValid: true,
          invalidReason: null,
          invalidMessage: null,
          payer: '0xPAYER',
        },
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new FacilitatorClient({
      baseUrl: 'https://web3.okx.com',
      apiKey: 'KEY',
      secretKey: 'SECRET',
      passphrase: 'PASS',
    });

    const result = await client.verify({
      x402Version: 2,
      paymentPayload: {} as never,
      paymentRequirements: {} as never,
    });

    expect(result.isValid).toBe(true);
    expect(result.payer).toBe('0xPAYER');

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://web3.okx.com/api/v6/pay/x402/verify');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['OK-ACCESS-KEY']).toBe('KEY');
    expect(headers['OK-ACCESS-SIGN']).toBeDefined();
    expect(headers['OK-ACCESS-TIMESTAMP']).toBeDefined();
    expect(headers['OK-ACCESS-PASSPHRASE']).toBe('PASS');
  });

  it('settle() posts to /api/v6/pay/x402/settle and returns settlement data', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        code: '0',
        msg: 'success',
        data: {
          success: true,
          errorReason: null,
          errorMessage: null,
          payer: '0xPAYER',
          transaction: '0xTXHASH',
          network: 'eip155:196',
          status: 'success',
        },
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new FacilitatorClient({
      baseUrl: 'https://web3.okx.com',
      apiKey: 'KEY',
      secretKey: 'SECRET',
      passphrase: 'PASS',
    });

    const result = await client.settle({
      x402Version: 2,
      paymentPayload: {} as never,
      paymentRequirements: {} as never,
      syncSettle: true,
    });

    expect(result.success).toBe(true);
    expect(result.transaction).toBe('0xTXHASH');
    expect(result.status).toBe('success');
  });

  it('retries verify on 5xx with backoff (max 1 retry)', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable', json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          code: '0',
          msg: 'success',
          data: {
            isValid: true,
            invalidReason: null,
            invalidMessage: null,
            payer: '0xPAYER',
          },
        }),
      });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new FacilitatorClient({
      baseUrl: 'https://web3.okx.com',
      apiKey: 'KEY',
      secretKey: 'SECRET',
      passphrase: 'PASS',
      retryDelayMs: 10,
    });

    const result = await client.verify({
      x402Version: 2,
      paymentPayload: {} as never,
      paymentRequirements: {} as never,
    });

    expect(result.isValid).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws FacilitatorError on 401 (HMAC auth failure)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ code: 'UNAUTHORIZED' }),
    }) as unknown as typeof fetch;

    const client = new FacilitatorClient({
      baseUrl: 'https://web3.okx.com',
      apiKey: 'KEY',
      secretKey: 'SECRET',
      passphrase: 'PASS',
    });

    await expect(
      client.verify({
        x402Version: 2,
        paymentPayload: {} as never,
        paymentRequirements: {} as never,
      })
    ).rejects.toThrow(/401|unauthorized/i);
  });
});
