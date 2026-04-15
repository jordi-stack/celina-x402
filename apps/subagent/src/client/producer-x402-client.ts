import type { Accept, Challenge402, PaymentPayload } from '@x402/shared';
import { Challenge402Schema, RESEARCH_SERVICE_CATALOG } from '@x402/shared';
import type { ResearchServiceName } from '@x402/shared';
import type {
  PaymentProof,
  WalletClient,
  X402PaymentClient,
} from '@x402/onchain-clients';
import type { Store } from '@x402/orchestrator';

export interface UpstreamCallResult<TData = unknown> {
  service: ResearchServiceName;
  status: number;
  data: TData | null;
  amountSpent: string;
  txHash: string | null;
  error: string | null;
  durationMs: number;
}

export interface ProducerX402ClientDeps {
  walletClient: WalletClient;
  paymentClient: X402PaymentClient;
  store: Store;
  producerUrl: string;
  subagentAccountId: string;
}

/**
 * Sub-agent's outgoing x402 client. Acts exactly like the Consumer's
 * session-runner does when it calls the Producer: fetch the 402 challenge,
 * sign via the onchainos CLI under the sub-agent's Account 3, replay with
 * the PAYMENT-SIGNATURE header, poll the shared payments table for the tx
 * hash. The key difference from the Consumer is the wallet switch: we
 * switch to subagentAccountId right before every sign so Consumer and
 * Sub-agent can coexist on the same global CLI state.
 */
export class ProducerX402Client {
  constructor(private readonly deps: ProducerX402ClientDeps) {}

  async callPaidService<TData = unknown>(
    service: Exclude<ResearchServiceName, 'research-deep-dive'>,
    body: Record<string, unknown>
  ): Promise<UpstreamCallResult<TData>> {
    const startedAt = Date.now();
    const meta = RESEARCH_SERVICE_CATALOG[service];
    const url = `${this.deps.producerUrl}${meta.path}`;

    const base: UpstreamCallResult<TData> = {
      service,
      status: 0,
      data: null,
      amountSpent: '0',
      txHash: null,
      error: null,
      durationMs: 0,
    };

    try {
      const challengeRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (challengeRes.status !== 402) {
        const text = await challengeRes.text();
        return {
          ...base,
          status: challengeRes.status,
          error: `expected 402, got ${challengeRes.status}: ${text.slice(0, 200)}`,
          durationMs: Date.now() - startedAt,
        };
      }

      const header = challengeRes.headers.get('PAYMENT-REQUIRED');
      if (!header) {
        return {
          ...base,
          error: 'missing PAYMENT-REQUIRED header on 402',
          durationMs: Date.now() - startedAt,
        };
      }

      const challenge = parseChallenge402(header);
      const accept = challenge.accepts[0];
      if (!accept) {
        return {
          ...base,
          error: 'empty accepts in challenge',
          durationMs: Date.now() - startedAt,
        };
      }

      // Switch to Sub-agent wallet (Account 3) right before signing. The
      // onchainos CLI stores active-account globally so this must happen
      // inside every call — Consumer may have switched to its own account
      // between our previous call and this one.
      await this.deps.walletClient.switchAccount(this.deps.subagentAccountId);

      const proof = await this.deps.paymentClient.signPayment({
        accepts: challenge.accepts,
      });

      const replay = await this.replayWithPayment(url, body, accept, proof);
      if (replay.status !== 200) {
        return {
          ...base,
          status: replay.status,
          amountSpent: accept.amount,
          error: `replay returned ${replay.status}: ${JSON.stringify(replay.data).slice(0, 200)}`,
          durationMs: Date.now() - startedAt,
        };
      }

      // Producer settles via onResponse. Wait for the nonce row in payments.
      const settled = await this.waitForSettlement(
        proof.authorization.nonce,
        15_000
      );

      return {
        ...base,
        status: 200,
        data: replay.data as TData,
        amountSpent: accept.amount,
        txHash: settled?.txHash ?? null,
        durationMs: Date.now() - startedAt,
      };
    } catch (err) {
      return {
        ...base,
        error: (err as Error).message,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  private async replayWithPayment(
    url: string,
    body: Record<string, unknown>,
    accept: Accept,
    proof: PaymentProof
  ): Promise<{ status: number; data: unknown }> {
    const paymentPayload: PaymentPayload = {
      x402Version: 2,
      resource: { url, description: '', mimeType: 'application/json' },
      accepted: accept,
      payload: {
        signature: proof.signature,
        authorization: proof.authorization,
        ...(proof.sessionCert ? { sessionCert: proof.sessionCert } : {}),
      },
    };
    const headerValue = Buffer.from(JSON.stringify(paymentPayload), 'utf8').toString(
      'base64'
    );
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PAYMENT-SIGNATURE': headerValue,
      },
      body: JSON.stringify(body),
    });
    let data: unknown;
    try {
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { error: text || 'non-JSON response' };
      }
    } catch (err) {
      data = { error: (err as Error).message };
    }
    return { status: res.status, data };
  }

  private async waitForSettlement(
    nonce: string,
    timeoutMs: number
  ): Promise<{ txHash: string } | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const payment = this.deps.store.findPaymentByNonce(nonce);
      if (payment?.status === 'settled' && payment.tx_hash) {
        return { txHash: payment.tx_hash };
      }
      if (payment?.status === 'settle_failed') return null;
      await new Promise((r) => setTimeout(r, 400));
    }
    return null;
  }
}

function parseChallenge402(headerValue: string): Challenge402 {
  const decoded = Buffer.from(headerValue, 'base64').toString('utf8');
  return Challenge402Schema.parse(JSON.parse(decoded));
}
