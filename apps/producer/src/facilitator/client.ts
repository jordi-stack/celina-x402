import { signOkxRequest } from '@x402/okx-auth';
import {
  FACILITATOR_PATHS,
  OkxApiEnvelopeSchema,
  VerifyResponseSchema,
  SettleResponseSchema,
  type OkxApiEnvelope,
  type VerifyRequest,
  type VerifyResponse,
  type SettleRequest,
  type SettleResponse,
} from '@x402/shared';

export interface FacilitatorConfig {
  baseUrl: string;
  apiKey: string;
  secretKey: string;
  passphrase: string;
  retryDelayMs?: number;
}

export class FacilitatorError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'FacilitatorError';
  }
}

export class FacilitatorClient {
  private readonly retryDelayMs: number;

  constructor(private readonly config: FacilitatorConfig) {
    this.retryDelayMs = config.retryDelayMs ?? 1_000;
  }

  async verify(request: VerifyRequest): Promise<VerifyResponse> {
    const envelope = await this.postWithRetry(FACILITATOR_PATHS.verify, request);
    return VerifyResponseSchema.parse(envelope.data);
  }

  async settle(request: SettleRequest): Promise<SettleResponse> {
    const envelope = await this.postWithRetry(FACILITATOR_PATHS.settle, request);
    return SettleResponseSchema.parse(envelope.data);
  }

  private async postWithRetry(
    path: string,
    body: unknown
  ): Promise<OkxApiEnvelope> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.postOnce(path, body);
      } catch (err) {
        lastErr = err;
        if (
          err instanceof FacilitatorError &&
          err.status !== undefined &&
          err.status >= 500 &&
          attempt === 0
        ) {
          await new Promise((r) => setTimeout(r, this.retryDelayMs));
          continue;
        }
        throw err;
      }
    }
    throw lastErr ?? new FacilitatorError('retry exhausted');
  }

  private async postOnce(
    path: string,
    body: unknown
  ): Promise<OkxApiEnvelope> {
    const bodyStr = JSON.stringify(body);
    const { timestamp, signature } = signOkxRequest({
      method: 'POST',
      path,
      body: bodyStr,
      secretKey: this.config.secretKey,
    });

    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'OK-ACCESS-KEY': this.config.apiKey,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': this.config.passphrase,
      },
      body: bodyStr,
    });

    if (!res.ok) {
      throw new FacilitatorError(
        `HTTP ${res.status} ${(res as { statusText?: string }).statusText ?? ''}`.trim(),
        res.status
      );
    }

    const json = (await res.json()) as unknown;
    const envelope = OkxApiEnvelopeSchema.parse(json);
    if (envelope.code !== '0') {
      throw new FacilitatorError(`API error: ${envelope.code} ${envelope.msg}`);
    }
    return envelope;
  }
}
