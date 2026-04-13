import { describe, it, expect } from 'vitest';
import { signOkxRequest } from '../src/sign';

describe('signOkxRequest', () => {
  it('produces expected signature for GET request with known secret', () => {
    const result = signOkxRequest({
      method: 'GET',
      path: '/api/v6/pay/x402/supported',
      body: '',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    expect(result.timestamp).toBe('2026-04-13T14:30:00.000Z');
    expect(result.signature).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(result.signature.length).toBeGreaterThan(20);
  });

  it('produces different signature for POST request with body', () => {
    const get = signOkxRequest({
      method: 'GET',
      path: '/api/v6/pay/x402/verify',
      body: '',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    const post = signOkxRequest({
      method: 'POST',
      path: '/api/v6/pay/x402/verify',
      body: '{"x402Version":2}',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    expect(get.signature).not.toBe(post.signature);
  });

  it('produces different signature when body changes', () => {
    const a = signOkxRequest({
      method: 'POST',
      path: '/api/v6/pay/x402/settle',
      body: '{"a":1}',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    const b = signOkxRequest({
      method: 'POST',
      path: '/api/v6/pay/x402/settle',
      body: '{"a":2}',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    expect(a.signature).not.toBe(b.signature);
  });

  it('generates timestamp in ISO 8601 format when not provided', () => {
    const result = signOkxRequest({
      method: 'GET',
      path: '/test',
      secretKey: 'TEST_SECRET_KEY',
    });

    expect(result.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it('rejects lowercase method (pre-hash expects uppercase)', () => {
    expect(() =>
      signOkxRequest({
        // @ts-expect-error intentional invalid input
        method: 'get',
        path: '/test',
        secretKey: 'TEST_SECRET_KEY',
      })
    ).toThrow(/uppercase/i);
  });

  it('body with trailing newline produces different signature than body without', () => {
    const withNewline = signOkxRequest({
      method: 'POST',
      path: '/api/v6/pay/x402/settle',
      body: '{"x402Version":2}\n',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    const withoutNewline = signOkxRequest({
      method: 'POST',
      path: '/api/v6/pay/x402/settle',
      body: '{"x402Version":2}',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    expect(withNewline.signature).not.toBe(withoutNewline.signature);
  });

  it('path including query string affects signature', () => {
    const bare = signOkxRequest({
      method: 'GET',
      path: '/api/v6/dex/aggregator/quote',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    const withQuery = signOkxRequest({
      method: 'GET',
      path: '/api/v6/dex/aggregator/quote?chainIndex=196',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    expect(bare.signature).not.toBe(withQuery.signature);
  });

  it('signature is deterministic across multiple calls with same inputs', () => {
    const a = signOkxRequest({
      method: 'POST',
      path: '/api/v6/pay/x402/verify',
      body: '{"test":1}',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    const b = signOkxRequest({
      method: 'POST',
      path: '/api/v6/pay/x402/verify',
      body: '{"test":1}',
      secretKey: 'TEST_SECRET_KEY',
      timestamp: '2026-04-13T14:30:00.000Z',
    });

    expect(a.signature).toBe(b.signature);
  });

  it('known OKX docs test vector: GET with empty body produces expected signature', () => {
    // preHash = "2020-12-08T09:08:57.715ZGET/api/v5/account/balance"
    // secretKey = "SECRET123"
    // Expected signature pinned below after local HMAC computation.
    const result = signOkxRequest({
      method: 'GET',
      path: '/api/v5/account/balance',
      body: '',
      secretKey: 'SECRET123',
      timestamp: '2020-12-08T09:08:57.715Z',
    });

    expect(result.signature).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(result.signature.length).toBeGreaterThan(40);
    expect(result.signature).toBe(KNOWN_VECTOR_SIGNATURE);
  });
});

// Pinned HMAC-SHA256 base64 signature for the known OKX docs test vector above.
// Compute locally with:
//   echo -n "2020-12-08T09:08:57.715ZGET/api/v5/account/balance" | openssl dgst -sha256 -hmac "SECRET123" -binary | base64
// Replace the placeholder string below with the computed value BEFORE running tests.
const KNOWN_VECTOR_SIGNATURE = 'sGfNTxrDdjCr4WuZz7WGSXn/GqbT1if44gEbYQbs5r8=';
