import type { Accept, Challenge402, PaymentPayload } from '@x402/shared';
import { Challenge402Schema } from '@x402/shared';
import type { PaymentProof } from '@x402/onchain-clients';

export function parseChallenge402(headerValue: string): Challenge402 {
  const decoded = Buffer.from(headerValue, 'base64').toString('utf8');
  return Challenge402Schema.parse(JSON.parse(decoded));
}

export interface ReplayOptions<TBody> {
  url: string;
  body: TBody;
  accept: Accept;
  proof: PaymentProof;
}

export interface ReplayResult<TData = unknown> {
  status: number;
  data: TData;
}

/**
 * Build PaymentPayload v2 and replay the original request with PAYMENT-SIGNATURE header.
 * Defensive: non-JSON error responses are returned as {error: <text>} so the
 * caller can decide how to react without crashing on JSON.parse.
 */
export async function replayWithPayment<TBody, TData = unknown>(
  opts: ReplayOptions<TBody>
): Promise<ReplayResult<TData>> {
  const paymentPayload: PaymentPayload = {
    x402Version: 2,
    resource: {
      url: opts.url,
      description: '',
      mimeType: 'application/json',
    },
    accepted: opts.accept,
    payload: {
      signature: opts.proof.signature,
      authorization: opts.proof.authorization,
      ...(opts.proof.sessionCert ? { sessionCert: opts.proof.sessionCert } : {}),
    },
  };

  const headerValue = Buffer.from(JSON.stringify(paymentPayload), 'utf8').toString('base64');

  const res = await fetch(opts.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PAYMENT-SIGNATURE': headerValue,
    },
    body: JSON.stringify(opts.body),
  });

  let data: TData;
  try {
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      data = (await res.json()) as TData;
    } else {
      const text = await res.text();
      data = { error: text || 'non-JSON response' } as unknown as TData;
    }
  } catch (err) {
    data = { error: (err as Error).message } as unknown as TData;
  }
  return { status: res.status, data };
}
